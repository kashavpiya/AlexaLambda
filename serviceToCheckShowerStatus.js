const AWS = require('aws-sdk');
const https = require('https');

let AlexaResponse = require("./alexa/skills/smarthome/AlexaResponse");

const lambda = new AWS.Lambda();
const cloudwatchevents = new AWS.CloudWatchEvents();
const powerShowerAPI = require('./powerShowerAPI');
const currentTime = require("./currentTime");
const TOS = currentTime();//new Date().toISOString(); //
const generateAlphanumericString = require('./generateAlphanumericString');
const serviceToCheckShowerStatus  = async (statusAPIRequestDetails) => {
    try {
        // Make API call
        console.log("statusAPIRequestDetails: ",JSON.stringify(statusAPIRequestDetails));
         const statusData = await makeApiCall(statusAPIRequestDetails);
        console.log("statusData: ",statusData);
        // Check if status is OK

       
        let deviceMode = ""//statusData.status == 0 ? "OFF" : (statusData.status == 1 ? "ECO" : statusData.status == 2 ? "HEAT" : "ECO")
        let listenForStatus = '';
        let notifyMode = '';
        if(statusAPIRequestDetails != undefined && statusAPIRequestDetails.listenStatus != undefined)
        {
            if(statusAPIRequestDetails.listenStatus ==  'SHOWERON')
            {
                deviceMode = 'ECO';
                listenForStatus = 1;
                notifyMode = 'Temperature.On';

            }
           else if(statusAPIRequestDetails.listenStatus ==  'SHOWEROFF')
            {
                deviceMode = 'OFF';
                listenForStatus = 0;  
                notifyMode = 'Temperature.Off';
            }
           else if(statusAPIRequestDetails.listenStatus ==  'SHOWERPREHEAT')
            {
                deviceMode = 'HEAT';
                listenForStatus = 3;
                notifyMode = 'Temperature.PreHeat';
            }
        }


        // if (parseInt(process.env.test_status) == listenForStatus){
       if (parseInt(statusData.status != undefined && parseInt(statusData.status) === listenForStatus)){
            // Perform desired action
            console.log("Status is OK. Perform action here.");
            await disableCloudWatchEventRule(statusAPIRequestDetails);
            // send notification
            let endpoint_id = statusAPIRequestDetails.deviceId;
            let token = statusAPIRequestDetails.access_token;
           
          
           const callNotificationSetup =  await new Promise(async (resolve) => {
                await setTimeout(async () => {
                  resolve(Promise.all([ await powerShowerAPI.sendAlexaNotification(await getNotificationObject(notifyMode,token,endpoint_id,deviceMode, statusData)), powerShowerAPI.sendAlexaNotification(await getNotificationObject('Temperature.Blank',token,endpoint_id,deviceMode, statusData))]));
                }, 20000); // 60000 milliseconds = 1 minute
              });

            console.log("triggerNotification: ",JSON.stringify(callNotificationSetup));
            let ar = new AlexaResponse(
                {
                    "namespace": "Alexa",
                    "name": "ChangeReport",
                    "correlationToken": statusAPIRequestDetails.correlationToken,
                    "token": token,
                    "endpoint":{
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
                                    "timeOfSample":await TOS,
                                    "uncertaintyInMilliseconds": 500
                                  },
                                  {
                                    "namespace": "Alexa.ThermostatController",
                                    "name": "targetSetpoint",
                                    "value": {
                                      "value": statusData.setTemp,
                                      "scale": "FAHRENHEIT"
                                    },
                                    "timeOfSample":await TOS,
                                    "uncertaintyInMilliseconds": 500 
                                  },
                                  {
                                    "namespace": "Alexa.TemperatureSensor",
                                    "name": "temperature",
                                    "value": {
                                      "value": statusData.temp,
                                      "scale": "FAHRENHEIT"
                                    },
                                    "timeOfSample":await TOS,
                                    "uncertaintyInMilliseconds": 500
                                  },
                                  {
                                    
                                    "namespace": "Alexa.ModeController",
                                    "instance":"Shower.Temperature",
                                    "name": "mode",
                                    "value": notifyMode,
                                    "timeOfSample":await TOS,
                                    "uncertaintyInMilliseconds": 500
                                   
                                  }]
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
                                "timeOfSample":await TOS,
                                "uncertaintyInMilliseconds": 500
                            }
                        ]
                      } 
                }
                
            );
            //ar.addContextProperty({"namespace":"Alexa.ThermostatController", "name": "AdjustTargetTemperature"});
           // ar.addPayloadEndpoint({ "endpointId": endpoint_id})
            console.log("ChangeReport initiated: ",JSON.stringify(ar.get()));
            return ar.get();
            
        } else {
            console.log("Status is not OK:", statusData );
            // Create CloudWatch Events rule when the script is executed
            if((statusAPIRequestDetails.eventType != undefined &&  statusAPIRequestDetails.eventType == "CheckShowerStatus") == false)
            {
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
            console.log("checkDeviceStatus: ",JSON.stringify(checkDeviceStatus));
            if(Object.keys(checkDeviceStatus).length >0 && checkDeviceStatus.payload!= undefined && checkDeviceStatus.payload.status!= undefined)
            { 

                return resolve(checkDeviceStatus.payload)
            }
            else{
                return resolve(-1);
            }
            
        } catch (error) {
            console.log("Error at makeApiCall notification service: ",JSON.stringify(error));
            return reject(error);
        }
    });
}

async function createCloudWatchEventRule(detailData) {
    try {
       //"access_token":["'+detailData.access_token+'"],
        const ruleParams = {
            Name: 'CheckAPIStatus'+detailData.deviceId,
            ScheduleExpression: 'rate(1 minute)',
            State: 'ENABLED',
            EventPattern:  ''
        };
        console.log("ruleParams: ",JSON.stringify(ruleParams));
        
        const ruleResponse = await cloudwatchevents.putRule(ruleParams).promise();
        const lambdaFunctionName = "PowerShowerAlexaSkill";
        const lambdaFunctionArn = "arn:aws:lambda:us-east-1:113271128265:function:PowerShowerAlexaSkill";
        
        const lambdaPermissionParams = {
            FunctionName: lambdaFunctionName,
            StatementId: 'CloudWatchEventsInvoke'+detailData.deviceId+Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000,
            Action: 'lambda:InvokeFunction',
            Principal: 'events.amazonaws.com',
            SourceArn: ruleResponse.RuleArn
        };
        
       // await lambda.addPermission(lambdaPermissionParams).promise();
        
        const targetParams = {
            Rule: 'CheckAPIStatus'+detailData.deviceId,
            Targets: [
                {
                    Id: '1',
                    Arn: lambdaFunctionArn,
                    Input: '{"eventType":"CheckShowerStatus","access_token":"'+detailData.access_token+'","deviceId":"'+detailData.deviceId+'","userId":'+detailData.userId+',"username":"'+detailData.username+'","correlationToken":"'+detailData.correlationToken+'","listenStatus":"'+detailData.listenStatus+'"}'
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
            Name: 'CheckAPIStatus'+detailData.deviceId
        };
        
        await cloudwatchevents.disableRule(params).promise();
        
        console.log('CloudWatch Events rule disabled successfully.');
    } catch (error) {
        console.error('Error disabling CloudWatch Events rule:', error);
    }
}

  async function getNotificationObject(notifyMode,token,endpoint_id,deviceMode, statusData) {
    return new Promise(async (resolve) => {
        const TOS = currentTime();
        let notificationData = {}
        notificationData =   {
            "event": {
                "header": {
                    "namespace": "Alexa",
                    "name": "ChangeReport",
                    "messageId": await generateAlphanumericString(),
                    "payloadVersion": "3"
                },
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token
                    },
                    "endpointId": endpoint_id
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
                            "timeOfSample":await TOS,
                            "uncertaintyInMilliseconds": 500
                          },
                          {
                            "namespace": "Alexa.ThermostatController",
                            "name": "targetSetpoint",
                            "value": {
                              "value": statusData.setTemp,
                              "scale": "FAHRENHEIT"
                            },
                            "timeOfSample":await TOS,
                            "uncertaintyInMilliseconds": 500 
                          },
                          {
                            "namespace": "Alexa.TemperatureSensor",
                            "name": "temperature",
                            "value": {
                              "value": statusData.temp,
                              "scale": "FAHRENHEIT"
                            },
                            "timeOfSample":await TOS,
                            "uncertaintyInMilliseconds": 500
                          },
                          {
                            "namespace": "Alexa.ModeController",
                            "instance":"Shower.Temperature",
                            "name": "mode",
                            "value": notifyMode,
                            "timeOfSample":await TOS,
                            "uncertaintyInMilliseconds": 500
                            // "valueChangeCondition": {
                            //     "comparator": "StateEquals",
                            //     "value": "Alexa.States.Done"
                            // }
                          }
                    
                    ]
                    }
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
                        "timeOfSample":await TOS,
                        "uncertaintyInMilliseconds": 500
                    }
                 
                ]
              } 
        
        }
       
      resolve(notificationData);
    });
  }


module.exports = serviceToCheckShowerStatus;

