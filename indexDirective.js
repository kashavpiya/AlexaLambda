// -*- coding: utf-8 -*-

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

/* eslint-disable  func-names */
/* eslint-disable  no-console */

'use strict';
const currentTime = require("./currentTime");

let AlexaResponse = require("./alexa/skills/smarthome/AlexaResponse");
const AWSSecretManagerForAPIToken = require('./AWSSecretManagerForAPIToken');
const powerShowerAPI = require('./powerShowerAPI');
const serviceToCheckShowerStatus = require('./serviceToCheckShowerStatus');
const TOS = currentTime();//new Date().toISOString(); //
exports.handler = async function (request, context) {
    console.log("indexDirective");
    console.log("context: ", JSON.stringify(context));
    // Validate we have an Alexa directive
    if (!('directive' in request)) {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": "Missing key: directive, Is request a valid Alexa directive?"
                }
            });
        return aer.get();
    }
    console.log("indexDirective1");
    // Check the payload version
    if (request.directive.header.payloadVersion !== "3") {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INTERNAL_ERROR",
                    "message": "This skill only supports Smart Home API version 3"
                }
            });
        return aer.get();
    }

    // Route based on our received Directive namespace
    let namespace = ((request.directive || {}).header || {}).namespace;
    let name = ((request.directive || {}).header || {}).name;
    if (namespace === 'Alexa.Authorization' && name == "AcceptGrant") {
        let lastToken = await AWSSecretManagerForAPIToken.getAPIToken("");
        let grantCode = (((((request.directive || "").payload || "").grant || "").code || "") || "");
        if ((lastToken != undefined || (lastToken != undefined && lastToken == "init")) || (grantCode != lastToken)) {

            let updateAPIToken = await AWSSecretManagerForAPIToken.updateAPIToken(grantCode, "");
            console.log("updateAPITokenCode: ", JSON.stringify(updateAPIToken))
            let refreshT = await powerShowerAPI.alexaNotificationTokenFromCode("refresh");
            console.log("refreshT: ", refreshT)
            let refreshTokenUpdate = await await AWSSecretManagerForAPIToken.updateAPIToken(refreshT, "-refresh")
            console.log("updateAPIToken success refreshTokenUpdate:", refreshTokenUpdate);
        }
        let aar = new AlexaResponse({ "namespace": "Alexa.Authorization", "name": "AcceptGrant.Response", });
        return aar.get();
    }

    if (namespace === 'Alexa.Discovery') {
        let token = ((((request.directive || {}).payload || {}).scope) || {}).token;
        console.log("indexDirective token: ", token);
        const deviceList = await powerShowerAPI.getAllDevicesFromAccount(token);
        console.log("indexDirective deviceList: ", JSON.stringify(deviceList));

        let adr = new AlexaResponse({ "namespace": "Alexa.Discovery", "name": "Discover.Response" });
        let capability_alexa = await adr.createPayloadEndpointCapability();
        let capability_alexa_customintent = await adr.createPayloadEndpointCapability({ "interface": "Alexa.CustomIntent", "supportedIntents": [{ "name": "BeepIntent" }] });
        let capability_alexa_thermostat = await adr.createPayloadEndpointCapability({ "interface": "Alexa.ThermostatController", "supported": [{ "name": "temperature" }], "proactivelyReported": true, "retrievable": true, "nonControllable": false });
        capability_alexa_thermostat.properties = {
            "supported": [{
                "name": "lowerSetpoint"
            },
            {
                "name": "upperSetpoint"
            },
            {
                "name": "thermostatMode"
            },
            {
                "name": "adaptiveRecoveryStatus"
            }
            ],
            "proactivelyReported": true,
            "retrievable": true,
            "nonControllable": false

        };
        capability_alexa_thermostat.configuration = {
            "supportedModes": ["HEAT", "OFF", "ECO", "ON", "PREHEAT"],
            "supportsScheduling": false
        };
        let capability_alexa_temeraturesensor = await adr.createPayloadEndpointCapability({ "interface": "Alexa.TemperatureSensor" });

        capability_alexa_temeraturesensor.properties = {
            "supported": [{
                "name": "temperature"
            }],
            "proactivelyReported": true,
            "retrievable": false,
            "nonControllable": false
        };
        let capability_alexa_modecontrol = await adr.createPayloadEndpointCapability({
            "interface": "Alexa.ModeController",
            "instance": "Shower.Temperature",
            "version": "3"
        });
        capability_alexa_modecontrol.properties =
        {
            "supported": [
                {
                    "name": "mode"
                }
            ],
            "retrievable": true,
            "proactivelyReported": true,
            "nonControllable": false
        };
        capability_alexa_modecontrol.configuration = {
            "ordered": true,
            "supportedModes": [
                {
                    "value": "Temperature.PreHeat",
                    "modeResources": {
                        "friendlyNames": [
                            {
                                "@type": "text",
                                "value": {
                                    "text": "Pre Heat",
                                    "locale": "en-US"
                                }
                            },
                            {
                                "@type": "text",
                                "value": {
                                    "text": "Preheating",
                                    "locale": "en-US"
                                }
                            }
                        ]
                    }
                },
                {
                    "value": "Temperature.Off",
                    "modeResources": {
                        "friendlyNames": [
                            {
                                "@type": "text",
                                "value": {
                                    "text": "Shower Head turned Off",
                                    "locale": "en-US"
                                }
                            },
                            {
                                "@type": "text",
                                "value": {
                                    "text": "water off",
                                    "locale": "en-US"
                                }
                            }
                        ]
                    }
                },
                {
                    "value": "Temperature.On",
                    "modeResources": {
                        "friendlyNames": [
                            {
                                "@type": "text",
                                "value": {
                                    "text": "water on",
                                    "locale": "en-US"
                                }
                            },
                            {
                                "@type": "text",
                                "value": {
                                    "text": " to water on",
                                    "locale": "en-US"
                                }
                            }
                        ]
                    }
                },
                {
                    "value": "Temperature.Blank",
                    "modeResources": {
                        "friendlyNames": [
                            {
                                "@type": "text",
                                "value": {
                                    "text": "Blank state",
                                    "locale": "en-US"
                                }
                            }
                        ]
                    }
                }
            ]
        };
        capability_alexa_modecontrol.semantics =
        {
            "stateMappings": [
                {
                    "@type": "StatesToValue",
                    "states": [
                        "Alexa.States.Done"
                        //"Alexa.States.Ready"
                    ],
                    "value": "Temperature.PreHeat"
                },
                {
                    "@type": "StatesToValue",
                    "states": [
                        "Alexa.States.Closed"
                    ],
                    "value": "Temperature.Off"
                },
                {
                    "@type": "StatesToValue",
                    "states": [
                        "Alexa.States.Open"
                    ],
                    "value": "Temperature.On"
                }

            ]
        };
        capability_alexa_modecontrol.capabilityResources = {
            "friendlyNames": [
                {
                    "@type": "text",
                    "value": {
                        "text": "Pre Heat",
                        "locale": "en-US"
                    }
                },
                {
                    "@type": "text",
                    "value": {
                        "text": "Preheating",
                        "locale": "en-US"
                    }
                }
            ]
        }
        let capability_alexa_ProactiveNotificationSource = await adr.createPayloadEndpointCapability({ "interface": "Alexa.ProactiveNotificationSource", "version": "3.0", "proactivelyReported": true });
        capability_alexa_ProactiveNotificationSource.configuration = {
            "notificationConditions": [
                {
                    "conditionType": "PropertyValueChange",
                    "property": {
                        "type": "AlexaInterface",
                        "interface": "Alexa.ModeController",
                        "instance": "Shower.Temperature",
                        "name": "mode"
                    },
                    "valueChangeCondition": {
                        "comparator": "StateEquals",
                        "value": "Alexa.States.Done"
                    }
                },
                {
                    "conditionType": "PropertyValueChange",
                    "property": {
                        "type": "AlexaInterface",
                        "interface": "Alexa.ModeController",
                        "instance": "Shower.Temperature",
                        "name": "mode"
                    },
                    "valueChangeCondition": {
                        "comparator": "StateEquals",
                        "value": "Alexa.States.Open"
                    }
                },
                {
                    "conditionType": "PropertyValueChange",
                    "property": {
                        "type": "AlexaInterface",
                        "interface": "Alexa.ModeController",
                        "instance": "Shower.Temperature",
                        "name": "mode"
                    },
                    "valueChangeCondition": {
                        "comparator": "StateEquals",
                        "value": "Alexa.States.Closed"
                    }
                }
            ]
        };
        // let capability_alexa_ProactiveNotificationSource = await adr.createPayloadEndpointCapability({ "interface": "Alexa.ProactiveNotificationSource", "version": "3.0", "proactivelyReported": true });
        // capability_alexa_ProactiveNotificationSource.configuration = {
        //     "notificationConditions": [
        //         {
        //             "conditionType": "PropertyValueChange",
        //             "property": {
        //                 "type": "AlexaInterface",
        //                 "interface": "Alexa.ThermostatController",
        //                 "name": "thermostatMode"
        //             },
        //             "valueChangeCondition": {
        //                 "comparator": "StringEquals",
        //                 "value": "HEAT"
        //             }
        //         }
        //     ]
        // }
        let capability_alexa_EndpointHealth = await adr.createPayloadEndpointCapability({ "interface": "Alexa.EndpointHealth", "version": "3", "proactivelyReported": true, "retrievable": true, "nonControllable": false });
        capability_alexa_EndpointHealth.properties = { "supported": [{ "name": "connectivity" }] };
        let capabilities = await [capability_alexa, capability_alexa_thermostat, capability_alexa_ProactiveNotificationSource, capability_alexa_temeraturesensor, capability_alexa_EndpointHealth, capability_alexa_modecontrol];//capability_alexa_EndpointHealth
        //capability_alexa_modecontrol

        if (deviceList != undefined && deviceList.deviceList != undefined && deviceList.deviceList.length > 0) {
            //deviceList.deviceList.length
            for (let index = 0; index < deviceList.deviceList.length; index++) {

                await adr.addPayloadEndpoint({ "endpointId": deviceList.deviceList[index].deviceId, "friendlyName": deviceList.deviceList[index].deviceName, "description": "Power Shower Smart Device", "capabilities": await capabilities });
            }
        }
        console.log("Discovery request sent: ", JSON.stringify(await adr.get()))
        return await adr.get();
    }
    if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode") || (namespace === 'Alexa.ModeController' && name === "SetMode")) {

        // let power_state_value = "OFF";
        // if (request.directive.header.name === "TurnOn")
        //     power_state_value = "ON";

        let endpoint_id = request.directive.endpoint.endpointId;
        console.log("endpoint_id: ", JSON.stringify(endpoint_id));
        let token = request.directive.endpoint.scope.token;
        let correlationToken = request.directive.header.correlationToken;
        let payload = request.directive.payload;

        console.log("indexDirective token: ", token);
        const deviceList = await powerShowerAPI.getAllDevicesFromAccount(token);
        console.log("indexDirective deviceList: ", JSON.stringify(deviceList));


        let getdeviceTriggered = {};
        console.log("ThermostatController getdeviceTriggered: ", JSON.stringify(getdeviceTriggered));
        if (deviceList != undefined && deviceList.deviceList != undefined && deviceList.deviceList.length > 0) {
            for (let index = 0; index < deviceList.deviceList.length; index++) {
                console.log("index: ", index);
                console.log("endpoint_id", JSON.stringify(endpoint_id));
                console.log("deviceId", JSON.stringify(deviceList.deviceList[index].deviceId));
                console.log("ep:di", JSON.stringify(endpoint_id == deviceList.deviceList[index].deviceId));
                if (deviceList.deviceList != undefined && deviceList.deviceList[index].deviceId != undefined && endpoint_id == deviceList.deviceList[index].deviceId) {
                    getdeviceTriggered = deviceList.deviceList[index];
                    break;
                }
            }
        }
        console.log("ThermostatController getdeviceTriggered2: ", JSON.stringify(getdeviceTriggered));
        if (getdeviceTriggered != undefined && Object.keys(getdeviceTriggered).length > 0) {
            console.log("ThermostatController getdeviceTriggered3: ", JSON.stringify(getdeviceTriggered));
            // call api command and set preheat mode
            let sendCommand = {};
            let showerState = '';
            let initiatedMode = '';
            if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode" && payload.thermostatMode.value === "ECO") || (namespace === 'Alexa.ModeController' && name === "SetMode" && payload.mode === "Temperature.On")) {
                showerState = 'SHOWERON';
                initiatedMode = "ECO";
            }
            if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode" && payload.thermostatMode.value === "OFF") || (namespace === 'Alexa.ModeController' && name === "SetMode" && payload.mode === "Temperature.Off")) {
                showerState = 'SHOWEROFF';
                initiatedMode = "OFF";

            }
            else if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode" && payload.thermostatMode.value === "HEAT") || (namespace === 'Alexa.ModeController' && name === "SetMode" && payload.mode === "Temperature.PreHeat")) {
                showerState = 'SHOWERPREHEAT';
                initiatedMode = "HEAT";
            }

            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


            const checkDeviceStatusUntilReady = async (deviceMetaData, maxRetries = 20, delay = 3000) => {
                for (let i = 0; i < maxRetries; i++) {
                    let deviceStatus = await getDeviceStatusWithRetry(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
                    console.log("deviceStatus: ", JSON.stringify(deviceStatus));
                    deviceStatus = await deviceStatus.payload;
        
                    if (deviceStatus.status === 3) {
                        console.log("Shower is Ready");
        
                        // Make the announcement
                        let ar = new AlexaResponse({
                            "namespace": "Alexa",
                            "name": "Response",
                            "correlationToken": deviceMetaData.correlationToken,
                            "token": deviceMetaData.access_token,
                            "endpoint": {
                                "scope": {
                                    "type": "BearerToken",
                                    "token": deviceMetaData.access_token
                                },
                                "endpointId": deviceMetaData.deviceId,
                                "cookie": {}
                            },
                            "context": {
                                "properties": [
                                    {
                                        "namespace": "Alexa.ThermostatController",
                                        "name": "thermostatMode",
                                        "value": "HEAT",
                                        "timeOfSample": new Date().toISOString(),
                                        "uncertaintyInMilliseconds": 500
                                    },
                                    {
                                        "namespace": "Alexa.ThermostatController",
                                        "name": "targetSetpoint",
                                        "value": {
                                            "value": deviceStatus.setTemp,
                                            "scale": "FAHRENHEIT"
                                        },
                                        "timeOfSample": new Date().toISOString(),
                                        "uncertaintyInMilliseconds": 500
                                    },
                                    {
                                        "namespace": "Alexa.TemperatureSensor",
                                        "name": "temperature",
                                        "value": {
                                            "value": deviceStatus.temp,
                                            "scale": "FAHRENHEIT"
                                        },
                                        "timeOfSample": new Date().toISOString(),
                                        "uncertaintyInMilliseconds": 500
                                    }
                                ]
                            }
                        });
        
                        console.log("Response initiated: Shower is Ready:", JSON.stringify(ar.get()));
                        return ar.get();
                    }
        
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
        
                console.log("Shower is not ready after maximum retries.");
                return null;
            };

            const getDeviceStatusWithRetry = async (token, deviceId, username, userId, maxRetries = 6, interval = 1000) => {
                let retries = 0;
                let deviceStatus = await powerShowerAPI.getDeviceQuery(token, deviceId, username, userId);
                let initialStatus = deviceStatus.payload.status;
            
                while (retries < maxRetries) {
                    await delay(interval);
                    deviceStatus = await powerShowerAPI.getDeviceQuery(token, deviceId, username, userId);
            
                    if (deviceStatus.payload.status !== initialStatus) {
                        return deviceStatus;
                    }
            
                    retries++;
                }
            
                return deviceStatus;
            };

            if (showerState != '') {
                // call api command and set mode
                sendCommand = await powerShowerAPI.sendShowerCommand(token, getdeviceTriggered.deviceId, showerState);
                console.log("called sendCommand: ", JSON.stringify(sendCommand));
                if (sendCommand.message != undefined && sendCommand.message == "Send ShowerControl Successfully") {
                    // sent command successfully
                    let deviceMetaData = {
                        correlationToken: request.directive.header.correlationToken,
                        access_token: token,
                        deviceId: getdeviceTriggered.deviceId,
                        userId: getdeviceTriggered.userId,
                        username: getdeviceTriggered.username,
                        listenStatus: showerState

                    }
                    
                    let deviceStatus = await getDeviceStatusWithRetry(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
                    console.log("deviceStatus: ", JSON.stringify(deviceStatus));
                    deviceStatus = await deviceStatus.payload;
                    console.log("deviceStatus: ", JSON.stringify(deviceStatus));
                    let deviceMode = deviceStatus.status == 0 ? "OFF" : (deviceStatus.status == 1 ? "ECO" : deviceStatus.status == 2 ? "HEAT" : "ECO"); // initiatedMode; //

                    console.log("deviceMetaData before serviceToCheckShowerStatus:  ", JSON.stringify(deviceMetaData));
                    const callNotificationService = await serviceToCheckShowerStatus(deviceMetaData);
                    console.log("callNotificationService return response: ", JSON.stringify(callNotificationService));
                    //return callNotificationService;
                    let ar = await new AlexaResponse({
                        "namespace": "Alexa", "name": "Response", "correlationToken": correlationToken, "token": token, "endpoint": {
                            "scope": {
                                "type": "BearerToken",
                                "token": token
                            },
                            "endpointId": endpoint_id,
                            "cookie": {}
                        },
                        "context": {
                            "properties": [
                                {
                                    "namespace": "Alexa.ThermostatController",
                                    "name": "thermostatMode",
                                    "value": deviceMode,
                                    "timeOfSample": await TOS,
                                    "uncertaintyInMilliseconds": 500
                                },
                                {
                                    "namespace": "Alexa.ThermostatController",
                                    "name": "targetSetpoint",
                                    "value": {
                                        "value": deviceStatus.setTemp,
                                        "scale": "FAHRENHEIT"
                                    },
                                    "timeOfSample": await TOS,
                                    "uncertaintyInMilliseconds": 500
                                },
                                {
                                    "namespace": "Alexa.TemperatureSensor",
                                    "name": "temperature",
                                    "value": {
                                        "value": deviceStatus.temp,
                                        "scale": "FAHRENHEIT"
                                    },
                                    "timeOfSample": await TOS,
                                    "uncertaintyInMilliseconds": 500
                                }
                            ]
                        }
                    })

                    // await ar.addPayloadEndpoint({ "endpointId": endpoint_id})
                    console.log("Response initiated:  heat mode:", JSON.stringify(ar.get()));
                    return ar.get();
                  // ---->>> return await checkDeviceStatusUntilReady(deviceMetaData);



                }
                else {
                    let ar = new AlexaResponse({
                        "namespace": "Alexa", "name": "Response", "correlationToken": correlationToken, "token": token, "endpoint": {
                            "scope": {
                                "type": "BearerToken",
                                "token": token
                            },
                            "endpointId": endpoint_id,
                            "cookie": {}
                        },
                        "payload": {}
                    })

                    //ar.addContextProperty({"namespace":"Alexa.ThermostatController", "name": "AdjustTargetTemperature"});
                    // ar.addPayloadEndpoint({ "endpointId": endpoint_id})
                    return ar.get();
                }
            }
            else {
                let ar = new AlexaResponse(
                    {
                        "namespace": "Alexa", "name": "Response",
                        "correlationToken": correlationToken,
                        "token": token,
                        "endpoint": {
                            "scope": {
                                "type": "BearerToken",
                                "token": token
                            },
                            "endpointId": endpoint_id,
                            "cookie": {}
                        },
                        "payload": {}

                    }
                );
                //ar.addContextProperty({"namespace":"Alexa.ThermostatController", "name": "AdjustTargetTemperature"});
                // ar.addPayloadEndpoint({ "endpointId": endpoint_id })
                return ar.get();
            }


            if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode" && payload.thermostatMode.value === "ECO") || (namespace === 'Alexa.ModeController' && name === "SetMode" && payload.mode === "Temperature.On")) {
                sendCommand = await powerShowerAPI.sendShowerCommand(token, getdeviceTriggered.deviceId, "SHOWERON");
                console.log("sendCommand.message: ", sendCommand.message);
                console.log("called sendCommand: ", JSON.stringify(sendCommand));
                let deviceMetaData = {
                    correlationToken: request.directive.header.correlationToken,
                    access_token: token,
                    deviceId: getdeviceTriggered.deviceId,
                    userId: getdeviceTriggered.userId,
                    username: getdeviceTriggered.username

                }
                let deviceStatus = await getDeviceStatusWithRetry(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
                //let deviceStatus = await powerShowerAPI.getDeviceQuery(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
                console.log("deviceStatus: ", JSON.stringify(deviceStatus));
                deviceStatus = await deviceStatus.payload;
                let deviceMode = deviceStatus.status == 0 ? "OFF" : (deviceStatus.status == 1 ? "ECO" : deviceStatus.status == 2 ? "HEAT" : "ECO"); //"ECO"; //
                let ar = new AlexaResponse({
                    "namespace": "Alexa", "name": "Response", "correlationToken": correlationToken, "token": token,
                    "endpoint": {
                        "scope": {
                            "type": "BearerToken",
                            "token": token
                        },
                        "endpointId": endpoint_id,
                        "cookie": {}
                    },
                    "context": {
                        "properties": [
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "thermostatMode",
                                "value": deviceMode,
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "targetSetpoint",
                                "value": {
                                    "value": deviceStatus.setTemp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.TemperatureSensor",
                                "name": "temperature",
                                "value": {
                                    "value": deviceStatus.temp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            }
                        ]
                    }

                })


                //  ar.addPayloadEndpoint({ "endpointId": endpoint_id })
                console.log("Response initiated: ", JSON.stringify(ar.get()));
                return ar.get();


            }
            if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode" && payload.thermostatMode.value === "OFF") || (namespace === 'Alexa.ModeController' && name === "SetMode" && payload.mode === "Temperature.Off")) {
                sendCommand = await powerShowerAPI.sendShowerCommand(token, getdeviceTriggered.deviceId, "SHOWEROFF");
                console.log("sendCommand.message: ", sendCommand.message);
                console.log("called sendCommand: ", JSON.stringify(sendCommand));
                let deviceMetaData = {
                    correlationToken: request.directive.header.correlationToken,
                    access_token: token,
                    deviceId: getdeviceTriggered.deviceId,
                    userId: getdeviceTriggered.userId,
                    username: getdeviceTriggered.username

                }
                let deviceStatus = await getDeviceStatusWithRetry(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
//                let deviceStatus = await powerShowerAPI.getDeviceQuery(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
                console.log("deviceStatus: ", JSON.stringify(deviceStatus));
                deviceStatus = await deviceStatus.payload;
                let deviceMode = deviceStatus.status == 0 ? "OFF" : (deviceStatus.status == 1 ? "ECO" : deviceStatus.status == 2 ? "HEAT" : "ECO"); //"OFF"; // 
                let ar = new AlexaResponse({
                    "namespace": "Alexa", "name": "Response", "correlationToken": correlationToken, "token": token, "endpoint": {
                        "scope": {
                            "type": "BearerToken",
                            "token": token
                        },
                        "endpointId": endpoint_id,
                        "cookie": {}
                    },
                    "context": {
                        "properties": [
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "thermostatMode",
                                "value": deviceMode,
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "targetSetpoint",
                                "value": {
                                    "value": deviceStatus.setTemp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.TemperatureSensor",
                                "name": "temperature",
                                "value": {
                                    "value": deviceStatus.temp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            }
                        ]
                    }
                })


                // ar.addPayloadEndpoint({ "endpointId": endpoint_id })
                console.log("Response initiated: ", JSON.stringify(ar.get()));
                return ar.get();


            }
            else if ((namespace === 'Alexa.ThermostatController' && name === "SetThermostatMode" && payload.thermostatMode.value === "HEAT") || 
         (namespace === 'Alexa.ModeController' && name === "SetMode" && payload.mode === "Temperature.PreHeat")) {



    // Call API command and set preheat mode
    sendCommand = await powerShowerAPI.sendShowerCommand(token, getdeviceTriggered.deviceId, "SHOWERPREHEAT");
    console.log("called sendCommand: ", JSON.stringify(sendCommand));

    if (sendCommand.message !== undefined && sendCommand.message === "Send ShowerControl Successfully") {
        // Command sent successfully
        let deviceMetaData = {
            correlationToken: request.directive.header.correlationToken,
            access_token: token,
            deviceId: getdeviceTriggered.deviceId,
            userId: getdeviceTriggered.userId,
            username: getdeviceTriggered.username
        };

        let deviceStatus = await getDeviceStatusWithRetry(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
        console.log("deviceStatus: ", JSON.stringify(deviceStatus));
        deviceStatus = await deviceStatus.payload;
        console.log("deviceStatus: ", JSON.stringify(deviceStatus));

        let deviceMode = deviceStatus.status === 0 ? "OFF" :
                         deviceStatus.status === 1 ? "ECO" :
                         deviceStatus.status === 2 ? "HEAT" : "ECO"; //"HEAT";

        console.log("deviceMetaData before serviceToCheckShowerStatus:  ", JSON.stringify(deviceMetaData));
        const callNotificationService = await serviceToCheckShowerStatus(deviceMetaData);
        console.log("callNotificationService return response: ", JSON.stringify(callNotificationService));

        let ar = new AlexaResponse({
            "namespace": "Alexa",
            "name": "Response",
            "correlationToken": correlationToken,
            "token": token,
            "endpoint": {
                "scope": {
                    "type": "BearerToken",
                    "token": token
                },
                "endpointId": endpoint_id,
                "cookie": {}
            },
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.ThermostatController",
                        "name": "thermostatMode",
                        "value": deviceMode,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 500
                    },
                    {
                        "namespace": "Alexa.ThermostatController",
                        "name": "targetSetpoint",
                        "value": {
                            "value": deviceStatus.setTemp,
                            "scale": "FAHRENHEIT"
                        },
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 500
                    },
                    {
                        "namespace": "Alexa.TemperatureSensor",
                        "name": "temperature",
                        "value": {
                            "value": deviceStatus.temp,
                            "scale": "FAHRENHEIT"
                        },
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 500
                    }
                ]
            }
        });

        console.log("Response initiated: heat mode:", JSON.stringify(ar.get()));
        return ar.get();
        //return await checkDeviceStatusUntilReady(deviceMetaData);
    


                }
                else {
                    let ar = new AlexaResponse({
                        "namespace": "Alexa", "name": "Response", "correlationToken": correlationToken, "token": token, "endpoint": {
                            "scope": {
                                "type": "BearerToken",
                                "token": token
                            },
                            "endpointId": endpoint_id,
                            "cookie": {}
                        },
                        "payload": {}
                    })

                    //ar.addContextProperty({"namespace":"Alexa.ThermostatController", "name": "AdjustTargetTemperature"});
                    // ar.addPayloadEndpoint({ "endpointId": endpoint_id})
                    return ar.get();
                }
            }
            else {
                let ar = new AlexaResponse(
                    {
                        "namespace": "Alexa", "name": "Response",
                        "correlationToken": correlationToken,
                        "token": token,
                        "endpoint": {
                            "scope": {
                                "type": "BearerToken",
                                "token": token
                            },
                            "endpointId": endpoint_id,
                            "cookie": {}
                        },
                        "payload": {}

                    }
                );
                //ar.addContextProperty({"namespace":"Alexa.ThermostatController", "name": "AdjustTargetTemperature"});
                // ar.addPayloadEndpoint({ "endpointId": endpoint_id })
                return ar.get();
            }
        }
    }

    if (namespace === 'Alexa' && name === "ReportState") {
        console.log("Entered StateReport1");
        let endpoint_id = request.directive.endpoint.endpointId;
        console.log("endpoint_id: ", JSON.stringify(endpoint_id));
        let token = request.directive.endpoint.scope.token;
        let correlationToken = request.directive.header.correlationToken;

        const deviceList = await powerShowerAPI.getAllDevicesFromAccount(token);
        console.log("indexDirective deviceList: ", JSON.stringify(deviceList));

        let getdeviceTriggered = {};
        if (deviceList != undefined && deviceList.deviceList != undefined && deviceList.deviceList.length > 0) {
            for (let index = 0; index < deviceList.deviceList.length; index++) {
                if (deviceList.deviceList != undefined && deviceList.deviceList[index].deviceId != undefined && endpoint_id == deviceList.deviceList[index].deviceId) {
                    getdeviceTriggered = deviceList.deviceList[index];
                }
            }
        }
        console.log("ReportState1: ", JSON.stringify(getdeviceTriggered));
        if (getdeviceTriggered != undefined && Object.keys(getdeviceTriggered).length > 0) {

            console.log("ReportState2");
            let deviceMetaData = {
                correlationToken: request.directive.header.correlationToken,
                access_token: token,
                deviceId: getdeviceTriggered.deviceId,
                userId: getdeviceTriggered.userId,
                username: getdeviceTriggered.username
            }
            console.log("ReportState3: ", JSON.stringify(deviceMetaData));
            let deviceStatus = await getDeviceStatusWithRetry(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
//            let deviceStatus = await powerShowerAPI.getDeviceQuery(deviceMetaData.access_token, deviceMetaData.deviceId, deviceMetaData.username, deviceMetaData.userId);
            console.log("deviceStatus: ", JSON.stringify(deviceStatus));
            deviceStatus = await deviceStatus.payload;
            let deviceMode = deviceStatus.status == 0 ? "OFF" : (deviceStatus.status == 1 ? "ECO" : deviceStatus.status == 2 ? "HEAT" : "ECO")
            console.log("deviceMetaData before serviceToCheckShowerStatus:  ", JSON.stringify(deviceMetaData));

            console.log("Entered StateReport2");
            let ar = new AlexaResponse(
                {
                    "namespace": "Alexa",
                    "name": "StateReport",
                    "correlationToken": correlationToken,
                    "token": token,
                    "endpoint": {
                        "scope": {
                            "type": "BearerToken",
                            "token": token
                        },
                        "endpointId": endpoint_id,
                        "cookie": {}
                    },
                    "payload": {},
                    "context": {
                        "properties": [
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "thermostatMode",
                                "value": deviceMode,
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.ThermostatController",
                                "name": "targetSetpoint",
                                "value": {
                                    "value": deviceStatus.setTemp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.TemperatureSensor",
                                "name": "temperature",
                                "value": {
                                    "value": deviceStatus.temp,
                                    "scale": "FAHRENHEIT"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            },
                            {
                                "namespace": "Alexa.EndpointHealth",
                                "name": "connectivity",
                                "value": {
                                    "value": "OK"
                                },
                                "timeOfSample": await TOS,
                                "uncertaintyInMilliseconds": 500
                            }

                        ]
                    }
                }
            );
            //ar.addContextProperty({"namespace":"Alexa.ThermostatController", "name": "AdjustTargetTemperature"});
            // ar.addPayloadEndpoint({ "endpointId": endpoint_id })
            console.log("Response initiated: ", JSON.stringify(ar.get()));
            return ar.get();
        }


    }



};

