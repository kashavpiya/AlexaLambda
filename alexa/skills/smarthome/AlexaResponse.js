// -*- coding: utf-8 -*-

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

/* eslint-disable  func-names */
/* eslint-disable  no-console */

'use strict';

let uuid = require('uuid/v4');


/**
 * Helper class to generate an AlexaResponse.
 * @class
 */
class AlexaResponse {

    /**
     * Check a value for validity or return a default.
     * @param value The value being checked
     * @param defaultValue A default value if the passed value is not valid
     * @returns {*} The passed value if valid otherwise the default value.
     */
    checkValue(value, defaultValue) {

        if (value === undefined || value == {} || value === "")
            return defaultValue;

        return value;
    }

    /**
     * Constructor for an Alexa Response.
     * @constructor
     * @param opts Contains initialization options for the response
     */
    constructor(opts) {
     console.log("AlexaResponse####: ",JSON.stringify(opts))
        if (opts === undefined)
            opts = {};

        if (opts.context !== undefined)
            this.context = this.checkValue(opts.context, undefined);

        if (opts.event !== undefined)
            this.event = this.checkValue(opts.event, undefined);
        else
            this.event = {
            "header": {
                "namespace": this.checkValue(opts.namespace, "Alexa"),
                "name": this.checkValue(opts.name, "Response"),
                "messageId": this.checkValue(opts.messageId, uuid()),
                "correlationToken": this.checkValue(opts.correlationToken, undefined),
                "payloadVersion": this.checkValue(opts.payloadVersion, "3")
            },
            "endpoint": {
                "scope": {
                    "type": "BearerToken",
                    "token": this.checkValue(opts.token, "INVALID"),
                },
                "endpointId": opts.endpoint != undefined ?this.checkValue(opts.endpoint.endpointId, "INVALID"):""
            },
            "payload": this.checkValue(opts.payload, {})
        };

        // No endpoint in an AcceptGrant or Discover request
        if (this.event.header.name === "AcceptGrant.Response" || this.event.header.name === "Discover.Response")
            delete this.event.endpoint;

    }

    /**
     * Add a property to the context.
     * @param opts Contains options for the property.
     */
   async addContextProperty(opts) {

        if (this.context === undefined)
            this.context = {properties: []};

        await this.context.properties.push(this.createContextProperty(opts));
        console.log("properties: ",JSON.stringify(this.context.properties));
    }

    /**
     * Add an endpoint to the payload.
     * @param opts Contains options for the endpoint.
     */
    addPayloadEndpoint(opts) {

        if (this.event.payload.endpoints === undefined)
            this.event.payload.endpoints = [];

        this.event.payload.endpoints.push(this.createPayloadEndpoint(opts));
    }

    /**
     * Creates a property for the context.
     * @param opts Contains options for the property.
     */
   async createContextProperty(opts) {
    const currentTime = require('./currentTime.js');
        return {
            'namespace': this.checkValue(opts.namespace, "Alexa.EndpointHealth"),
            'name': this.checkValue(opts.name, "connectivity"),
            'value': this.checkValue(opts.value, {"value": "OK"}),
            'timeOfSample':'',//await currentTime(),
            'uncertaintyInMilliseconds': this.checkValue(opts.uncertaintyInMilliseconds, 0)
        };
    }

    /**
     * Creates an endpoint for the payload.
     * @param opts Contains options for the endpoint.
     */
    createPayloadEndpoint(opts) {

        if (opts === undefined) opts = {};

        // Return the proper structure expected for the endpoint
        let endpoint =
            {
                "capabilities": this.checkValue(opts.capabilities, []),
                "description": this.checkValue(opts.description, "Sample Endpoint Description"),
                "displayCategories": this.checkValue(opts.displayCategories, ["THERMOSTAT"]),
                "endpointId": opts.endpointId,
                "friendlyName": this.checkValue(opts.friendlyName, "Sample Endpoint"),
                "manufacturerName": this.checkValue(opts.manufacturerName, "Sample Manufacturer")
            };

        if (opts.hasOwnProperty("cookie"))
            endpoint["cookie"] = this.checkValue('cookie', {});

        return endpoint
    }

    /**
     * Creates a capability for an endpoint within the payload.
     * @param opts Contains options for the endpoint capability.
     */
    createPayloadEndpointCapability(opts) {

        if (opts === undefined) opts = {};

        let capability = {};
        capability['type'] = this.checkValue(opts.type, "AlexaInterface");
        capability['interface'] = this.checkValue(opts.interface, "Alexa");
        capability['version'] = this.checkValue(opts.version, "3");
        capability['instance'] = this.checkValue(opts.instance, undefined);

        let supported = this.checkValue(opts.supported, false);
        if (supported) {
            capability['properties'] = {};
            capability['properties']['supported'] = supported;
            capability['properties']['proactivelyReported'] = true;
            capability['properties']['retrievable'] = true;
            capability['properties']["nonControllable"] = false;
        }

        let supportedIntents = this.checkValue(opts.supportedIntents, false);
        if (supportedIntents) {
            capability['configuration'] = {};
            capability['configuration']['supportedIntents'] = supportedIntents;
        }

        return capability
    }

    /**
     * Get the composed Alexa Response.
     * @returns {AlexaResponse}
     */
    get() {
        return this;
    }
}

module.exports = AlexaResponse;