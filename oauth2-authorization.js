const EventEmitter = require('events');
const open = require('open');  // Import the 'open' package to open browser
const axios = require('axios');
const express = require('express');
const http = require('http');
const { URL } = require('url');  // Added to parse redirectUri

module.exports = function(RED) {
    function OAuth2ConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.events = new EventEmitter();

        // Configuration details
        node.clientId = config.clientId;
        node.clientSecret = config.clientSecret;
        node.authURL = config.authURL;
        node.tokenURL = config.tokenURL;
        node.redirectUri = config.redirectUri || 'https://nodered-bojana.halton.node.mk/oauth2/callback';
        node.scopes = config.scopes;

        node.log(`OAuth2 node initialized with redirectUri: ${node.redirectUri}`);

        let accessToken = null;
        
        // Register the callback endpoint with Node-RED
        const parsedUrl = new URL(node.redirectUri);
        const callbackPath = parsedUrl.pathname;
        
        node.log(`Registering OAuth2 callback handler at path: ${callbackPath}`);
        
        // Setup the HTTP route handler for the callback using Node-RED's built-in HTTP server
        RED.httpNode.get(callbackPath, async function(req, res) {
            node.log("OAuth2 callback received!");
            node.log(`Query parameters: ${JSON.stringify(req.query)}`);
            
            const code = req.query.code;

            if (!code) {
                node.error("Authorization code not found in the callback");
                return res.status(400).send("Authorization code not found in the callback");
            }

            node.log(`Authorization code received: ${code.substring(0, 5)}...`);

            try {
                node.log("Starting token exchange process...");
                accessToken = await exchangeCodeForToken(code);
                node.log("Access token obtained successfully!");
                res.send('<h3>Authorization successful! You can close this window.</h3>');
                node.events.emit('token_ready', accessToken);
            } catch (error) {
                node.error("Token exchange failed", error);
                node.error(`Error details: ${JSON.stringify(error.response?.data || {})}`);
                if (!res.headersSent) {
                    res.status(500).send("Token exchange failed");
                }
            }
        });

        node.startLocalServer = function() {
            node.log("startLocalServer method called - opening authorization URL directly");
            
            // Instead of starting a local server, we'll just open the authorization URL
            const authorizationURL = `${node.authURL}?response_type=code&client_id=${node.clientId}&redirect_uri=${encodeURIComponent(node.redirectUri)}&scope=${encodeURIComponent(node.scopes)}&response_mode=query`;
            
            node.log(`Authorization URL: ${authorizationURL}`);
            
            open(authorizationURL).then(() => {
                node.log("Browser opened to start OAuth2 authorization.");
            }).catch((error) => {
                node.error("Failed to open browser for OAuth2 authorization", error);
                node.error(`Open error details: ${error.message}`);
            });
        };

        async function exchangeCodeForToken(code) {
            try {
                node.log("Preparing token exchange request...");
                
                const tokenRequestParams = {
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: node.redirectUri,
                    client_id: node.clientId,
                    client_secret: node.clientSecret,
                    scope: node.scopes
                };
                
                node.log(`Token URL: ${node.tokenURL}`);
                node.log(`Token request parameters: ${JSON.stringify({
                    ...tokenRequestParams,
                    client_secret: "****" // Hide actual secret in logs
                })}`);
                
                const response = await axios.post(node.tokenURL, new URLSearchParams(tokenRequestParams), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                
                node.log("Token exchange successful");
                node.log(`Response status: ${response.status}`);
                node.log(`Response contains access_token: ${!!response.data.access_token}`);
                
                return response.data.access_token;
            } catch (error) {
                node.error(`Token exchange failed: ${error.message}`);
                if (error.response) {
                    node.error(`Response status: ${error.response.status}`);
                    node.error(`Response data: ${JSON.stringify(error.response.data)}`);
                }
                throw new Error('Failed to exchange code for token: ' + error.message);
            }
        }

        node.getAccessToken = function() {
            node.log(`getAccessToken called, token exists: ${!!accessToken}`);
            return accessToken;
        };

        node.on('close', function() {
            node.log("OAuth2 node closed");
        });
    }

    RED.nodes.registerType("oauth2-authorization", OAuth2ConfigNode);
};