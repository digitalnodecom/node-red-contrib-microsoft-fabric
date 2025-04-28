const axios = require('axios');
const fs = require('fs');

module.exports = function (RED) {
    function DataAutomationNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        node.oauth2Config = RED.nodes.getNode(config.oauth2);

        if (!node.oauth2Config) {
            return node.error("Missing OAuth2 configuration node");
        }

        node.on('input', async function (msg) {
            if (!node.oauth2Config) {
                return node.error("OAuth2 configuration is required");
            }

            let accessToken = node.oauth2Config.getAccessToken();

            if (!accessToken) {
                node.log("No access token found. Starting local OAuth2 server...");
                node.oauth2Config.startLocalServer();
                node.oauth2Config.events.once('token_ready', (token) => {
                    if (token) {
                        node.log("Access token obtained, proceeding with request.");
                        executeAction(token, msg);
                    } else {
                        node.error("Failed to obtain access token.");
                    }
                });
            } else {
                node.log("Using existing access token.");
                executeAction(accessToken, msg);
            }
        });

        async function executeAction(token, msg) {
            const url = msg.payload.url || config.url;
            const filePath = msg.payload.filePath || config.filePath;

            if (!url || !filePath) {
                return node.error("Both URL and File Path are required");
            }

            await handleDataAutomation(node, url, filePath, token, msg);

        }

        async function handleDataAutomation(node, url, filePath, token, msg) {
            try {
                const stats = fs.statSync(filePath);
        
                console.log("Creating file...");
                await axios.put(url, null, {
                    params: { resource: 'file' },
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Authorization': `Bearer ${token}`
                    }
                });
                console.log("File created.");
        
                console.log("Starting upload...");
                await axios.patch(url, fs.createReadStream(filePath), {
                    params: { action: 'append', position: 0 },
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Authorization': `Bearer ${token}`,
                        'Content-Length': stats.size
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                });
                console.log("Upload complete.");
        
                console.log("Flushing...");
                await axios.patch(url, null, {
                    params: { action: 'flush', position: stats.size },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log("Flush complete.");
        
                msg.payload = { status: "Upload successful" };
                node.send(msg);
            } catch (error) {
                handleError(node, error, msg);
            }
        }
        

        function handleError(node, error, msg) {
            let errorMessage = "An error occurred";
            if (error.response) {
                errorMessage = `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`;
            } else if (error.request) {
                errorMessage = "No response received from server";
            } else {
                errorMessage = `Error setting up request: ${error.message}`;
            }
            node.error(errorMessage, msg);
            msg.payload = { error: errorMessage };
            node.send(msg);
        }
    }

    RED.nodes.registerType("data-automation", DataAutomationNode);
};
