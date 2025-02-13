const EventEmitter = require('events');
const open = require('open');  // Import the 'open' package to open browser
const axios = require('axios');
const express = require('express');
const http = require('http');

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
        node.redirectUri = config.redirectUri || 'http://localhost:1880/oauth2/callback';
        node.scopes = config.scopes;

        let accessToken = null;
        let app = express();
        let server;

        node.startLocalServer = function() {
            if (!server) {
                server = http.createServer(app);
                server.listen(1880, () => {
                    node.log("Local server running on port 1880 for OAuth2 callback");

                    const authorizationURL = `${node.authURL}?response_type=code&client_id=${node.clientId}&redirect_uri=${encodeURIComponent(node.redirectUri)}&scope=${encodeURIComponent(node.scopes)}&response_mode=query`;
                    open(authorizationURL).then(() => {
                        node.log("Browser opened to start OAuth2 authorization.");
                    }).catch((error) => {
                        node.error("Failed to open browser for OAuth2 authorization", error);
                    });
                });

                app.get('/oauth2/callback', async (req, res) => {
                    const code = req.query.code;
                
                    if (!code) {
                        return res.status(400).send("Authorization code not found in the callback");
                    }
                
                    try {
                        accessToken = await exchangeCodeForToken(code);
                        // Send success response
                        res.send('<h3>Authorization successful! You can close this window.</h3>');
                        // Emit the 'token_ready' event
                        node.events.emit('token_ready', accessToken);
                    } catch (error) {
                        // Log the error and send failure response
                        node.error("Token exchange failed", error);
                        if (!res.headersSent) {
                            res.status(500).send("Token exchange failed");
                        }
                    }
                });
                
            }
        };

        async function exchangeCodeForToken(code) {
            try {
                const response = await axios.post(node.tokenURL, new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: node.redirectUri,
                    client_id: node.clientId,
                    client_secret: node.clientSecret,
                    scope: node.scopes
                }), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                return response.data.access_token;
            } catch (error) {
                throw new Error('Failed to exchange code for token: ' + error.message);
            }
        }

        node.getAccessToken = function() {
            return accessToken;
        };

        node.on('http_request_completed', function() {
            if (server) {
                server.close(() => {
                    node.log("OAuth2 callback server closed after HTTP request completed");
                });
            }
        });

        node.on('close', function() {
            if (server) {
                server.close(() => {
                    node.log("OAuth2 callback server closed");
                });
            }
        });
    }

    RED.nodes.registerType("oauth2-authorization", OAuth2ConfigNode);
};
