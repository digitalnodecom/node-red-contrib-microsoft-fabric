const EventEmitter = require('events');
const open = require('open');
const axios = require('axios');
const { URL } = require('url');

module.exports = function (RED) {
    function OAuth2ConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.events = new EventEmitter();

        node.clientId = config.clientId;
        node.clientSecret = config.clientSecret;
        node.authURL = config.authURL;
        node.tokenURL = config.tokenURL;
        node.redirectUri = config.redirectUri;
        node.scopes = config.scopes;

        node.log(`OAuth2 node initialized with redirectUri: ${node.redirectUri}`);

        let accessToken = null;
        let refreshToken = null;
        let expiresIn = null;
        let accessTokenObtainedAt = null;

        const parsedUrl = new URL(node.redirectUri);
        const callbackPath = parsedUrl.pathname;


        RED.httpNode.get(callbackPath, async function (req, res) {
            const code = req.query.code;

            if (!code) {
                node.error("Authorization code not found in the callback");
                return res.status(400).send("Authorization code not found in the callback");
            }

            try {
                node.log("Starting token exchange process...");
                const tokenData = await exchangeCodeForToken(code);

                node.log("Token response data: " + JSON.stringify(tokenData));

                // Store token data
                accessToken = tokenData.access_token;
                refreshToken = tokenData.refresh_token;
                expiresIn = tokenData.expires_in;
                accessTokenObtainedAt = Date.now();

                node.log(`Access token will expire in ${expiresIn} seconds.`);
                node.log(`refresh token${refreshToken} .`);

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

        node.startLocalServer = function () {
            node.log("Opening authorization URL...");
            const authorizationURL = `${node.authURL}?response_type=code&client_id=${node.clientId}&redirect_uri=${encodeURIComponent(node.redirectUri)}&scope=${encodeURIComponent(node.scopes)}&response_mode=query`;
            node.log(`Authorization URL: ${authorizationURL}`);
            open(authorizationURL).then(() => {
                node.log("Browser opened to start OAuth2 authorization.");
            }).catch((error) => {
                node.error("Failed to open browser for OAuth2 authorization", error);
                node.error(`Open error details: ${error.message}`);

            });
        };

        node.getAccessToken = async function () {
            const now = Date.now();
            const tokenAge = (now - (accessTokenObtainedAt || 0)) / 1000;

            if (accessToken && expiresIn && tokenAge < expiresIn - 60) {
                node.log(`Access token is valid (${Math.round(expiresIn - tokenAge)}s left).`);
                return accessToken;
            }

            if (refreshToken) {
                node.log("Access token expired or near expiry. Attempting to refresh...");
                const refreshed = await refreshAccessToken();
                return refreshed ? accessToken : null;
            }

            node.warn("No access token available and no refresh token set.");
            return null;
        };

        async function exchangeCodeForToken(code) {
            const params = {
                grant_type: 'authorization_code',
                code,
                redirect_uri: node.redirectUri,
                client_id: node.clientId,
                client_secret: node.clientSecret,
                scope: node.scopes
            };

            const response = await axios.post(node.tokenURL, new URLSearchParams(params), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return response.data;
        }

        async function refreshAccessToken() {
            try {
                const params = {
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: node.clientId,
                    client_secret: node.clientSecret,
                    scope: node.scopes
                };

                const response = await axios.post(node.tokenURL, new URLSearchParams(params), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                accessToken = response.data.access_token;
                refreshToken = response.data.refresh_token || refreshToken;
                expiresIn = response.data.expires_in;
                accessTokenObtainedAt = Date.now();

                node.log("Token refreshed successfully.");
                return true;
            } catch (error) {
                node.error("Failed to refresh token", error);
                if (error.response) {
                    node.error(`Response: ${JSON.stringify(error.response.data)}`);
                }
                return false;
            }
        }

        node.on('close', function () {
            node.log("OAuth2 node closed");
        });
    }

RED.nodes.registerType("oauth2-authorization", OAuth2ConfigNode);
};
