const AWS = require('aws-sdk');
const https = require('https');

let AlexaResponse = require("./alexa/skills/smarthome/AlexaResponse");

const lambda = new AWS.Lambda();
const cloudwatchevents = new AWS.CloudWatchEvents();
const powerShowerAPI = require('./powerShowerAPI');
const currentTime = require("./currentTime");
const TOS = currentTime(); // new Date().toISOString(); //
const generateAlphanumericString = require('./generateAlphanumericString');

const serviceToCheckShowerStatus = async (statusAPIRequestDetails) => {
    try {
        // Make API call
        console.log("statusAPIRequestDetails: ", JSON.stringify(statusAPIRequestDetails));
        const statusData = await makeApiCall(statusAPIRequestDetails);
        console.log("statusData: ", statusData);

        let deviceMode = "";
        let listenForStatus = 3;
        let notifyMode = '';

        if (statusAPIRequestDetails && statusAPIRequestDetails.listenStatus) {
            if (statusAPIRequestDetails.listenStatus === 'SHOWERPREHEAT') {
                deviceMode = 'HEAT';
                listenForStatus = 3;
                notifyMode = 'Temperature.PreHeat';
            }
        }

        if (statusData && parseInt(statusData.status) === listenForStatus) {
            console.log("Status is OK. Perform action here.");
            await disableCloudWatchEventRule(statusAPIRequestDetails);
        
            let endpoint_id = statusAPIRequestDetails.deviceId;
            let token = statusAPIRequestDetails.access_token;
        
            const callNotificationSetup = await new Promise(async (resolve) => {
                await setTimeout(async () => {
                    resolve(Promise.all([
                        powerShowerAPI.sendAlexaNotification(await getNotificationObject(notifyMode, token, endpoint_id, deviceMode, statusData)),
                        powerShowerAPI.sendAlexaNotification(await getNotificationObject('Temperature.Blank', token, endpoint_id, deviceMode, statusData))
                    ]));
                }, 30000); // 60000 milliseconds = 1 minute
            });
        
            console.log("triggerNotification: ", JSON.stringify(callNotificationSetup));
            let ar = new AlexaResponse({
                "namespace": "Alexa",
                "name": "ChangeReport",
                "correlationToken": statusAPIRequestDetails.correlationToken,
                "token": token,
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token
                    },
                    "endpointId": endpoint_id,
                    "cookie": {}
                },
                "payload": {
                    "change": {
                        "cause": {
                            "type": "PERIODIC_POLL"
                        },
                        "properties": [
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "thermostatMode",
                                "value": deviceMode,
                                "timeOfSample": TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "targetSetpoint",
                                "value": {
                                    "value": statusData.setTemp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.TemperatureSensor",
                                "name": "temperature",
                                "value": {
                                    "value": statusData.temp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.ModeController",
                                "instance": "Shower.Temperature",
                                "name": "mode",
                                "value": notifyMode,
                                "timeOfSample": TOS,
                                "uncertaintyInMilliseconds": 500
                            }
                        ]
                    }
                },
                "context": {
                    "properties": [
                        {
                            "namespace": "Alexa.EndpointHealth",
                            "name": "connectivity",
                            "value": {
                                "value": "OK"
                            },
                            "timeOfSample": TOS,
                            "uncertaintyInMilliseconds": 500
                        },
                        {
                            "namespace": "Alexa.ModeController",
                            "instance": "Shower.Status",
                            "name": "mode",
                            "value": "Ready",
                            "timeOfSample": TOS,
                            "uncertaintyInMilliseconds": 500
                        }
                    ]
                }
            });
        
            console.log("ChangeReport initiated: ", JSON.stringify(ar.get()));
            return ar.get();
        
        } else {
            console.log("Status is not OK:", statusData);
            if (!(statusAPIRequestDetails.eventType && statusAPIRequestDetails.eventType === "CheckShowerStatus")) {
                await createCloudWatchEventRule(statusAPIRequestDetails);
            }
            return "triggerCreated";
        }
    } catch (error) {
        console.error("Error:", error);
    }
};

async function makeApiCall(statusAPIRequestDetails) {
    return new Promise(async (resolve, reject) => {
        try {
            const checkDeviceStatus = await powerShowerAPI.getDeviceQuery(statusAPIRequestDetails.access_token, statusAPIRequestDetails.deviceId, statusAPIRequestDetails.username, statusAPIRequestDetails.userId);
            console.log("checkDeviceStatus: ", JSON.stringify(checkDeviceStatus));
            if (Object.keys(checkDeviceStatus).length > 0 && checkDeviceStatus.payload && checkDeviceStatus.payload.status) {
                resolve(checkDeviceStatus.payload);
            } else {
                resolve(-1);
            }
        } catch (error) {
            console.error("Error at makeApiCall notification service: ", JSON.stringify(error));
            reject(error);
        }
    });
}

async function createCloudWatchEventRule(detailData) {
    try {
        const ruleParams = {
            Name: 'CheckAPIStatus' + detailData.deviceId,
            ScheduleExpression: 'rate(1 minute)',
            State: 'ENABLED',
            EventPattern: ''
        };
        console.log("ruleParams: ", JSON.stringify(ruleParams));

        const ruleResponse = await cloudwatchevents.putRule(ruleParams).promise();
        const lambdaFunctionName = "PowerShowerAlexaSkill";
        const lambdaFunctionArn = "arn:aws:lambda:us-east-1:113271128265:function:PowerShowerAlexaSkill";

        const lambdaPermissionParams = {
            FunctionName: lambdaFunctionName,
            StatementId: 'CloudWatchEventsInvoke' + detailData.deviceId + Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000,
            Action: 'lambda:InvokeFunction',
            Principal: 'events.amazonaws.com',
            SourceArn: ruleResponse.RuleArn
        };

        // await lambda.addPermission(lambdaPermissionParams).promise();

        const targetParams = {
            Rule: 'CheckAPIStatus' + detailData.deviceId,
            Targets: [
                {
                    Id: '1',
                    Arn: lambdaFunctionArn,
                    Input: JSON.stringify({
                        eventType: "CheckShowerStatus",
                        access_token: detailData.access_token,
                        deviceId: detailData.deviceId,
                        userId: detailData.userId,
                        username: detailData.username,
                        correlationToken: detailData.correlationToken,
                        listenStatus: detailData.listenStatus
                    })
                }
            ]
        };

        await cloudwatchevents.putTargets(targetParams).promise();

        console.log('CloudWatch Events rule created successfully.');
    } catch (error) {
        console.error('Error creating CloudWatch Events rule:', error);
    }
}

async function disableCloudWatchEventRule(detailData) {
    try {
        const params = {
            Name: 'CheckAPIStatus' + detailData.deviceId
        };

        await cloudwatchevents.disableRule(params).promise();

        console.log('CloudWatch Events rule disabled successfully.');
    } catch (error) {
        console.error('Error disabling CloudWatch Events rule:', error);
    }
}

async function getNotificationObject(notifyMode, token, endpoint_id, deviceMode, statusData) {
    return new Promise(async (resolve) => {
        const TOS = currentTime();
        let notificationData = {
            event: {
                header: {
                    namespace: "Alexa",
                    name: "ChangeReport",
                    messageId: await generateAlphanumericString(),
                    payloadVersion: "3"
                },
                endpoint: {
                    scope: {
                        type: "BearerToken",
                        token: token
                    },
                    endpointId: endpoint_id
                },
                payload: {
                    change: {
                        cause: {
                            type: "PERIODIC_POLL"
                        },
                        properties: [
                            {
                                namespace: "Alexa.ThermostatController",
                                name: "thermostatMode",
                                value: deviceMode,
                                timeOfSample: TOS,
                                uncertaintyInMilliseconds: 500
                            },
                            {
                                namespace: "Alexa.ThermostatController",
                                name: "targetSetpoint",
                                value: {
                                    value: statusData.setTemp,
                                    scale: "FAHRENHEIT"
                                },
                                timeOfSample: TOS,
                                uncertaintyInMilliseconds: 500
                            },
                            {
                                namespace: "Alexa.TemperatureSensor",
                                name: "temperature",
                                value: {
                                    value: statusData.temp,
                                    scale: "FAHRENHEIT"
                                },
                                timeOfSample: TOS,
                                uncertaintyInMilliseconds: 500
                            },
                            {
                                namespace: "Alexa.ModeController",
                                instance: "Shower.Temperature",
                                name: "mode",
                                value: notifyMode,
                                timeOfSample: TOS,
                                uncertaintyInMilliseconds: 500
                            }
                        ]
                    }
                },
                context: {
                    properties: [
                        {
                            namespace: "Alexa.EndpointHealth",
                            name: "connectivity",
                            value: {
                                value: "OK"
                            },
                            timeOfSample: TOS,
                            uncertaintyInMilliseconds: 500
                        }
                    ]
                }
            }
        };
        resolve(notificationData);
    });
}

module.exports = serviceToCheckShowerStatus;