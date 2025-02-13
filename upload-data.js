const { json } = require('express');
const axios = require('axios');


module.exports = function (RED) {
    function UploadDataNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.oauth2Config = RED.nodes.getNode(config.oauth2);

        if (!node.oauth2Config) {
            node.error("Missing OAuth2 configuration node");
            return;
        }

        node.on('input', async function (msg) {

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
            const action = config.action || msg.payload.action;
            const url = msg.payload.url || config.url;
           

            if (!url) {
                return node.error(" URL is required");
            }

            if (action === "read") {
                await handleRead(node, url, token, msg);
            }
            else if (action === "upload") {

                await handleUpload(node, url, token, msg);
            }


        }
        async function handleRead(node, url, token, msg) {
            try {
                const maxResultsUploadData = config.maxResultsUploadData || msg.payload.maxResultsUploadData;
                const continuationToken = msg.payload?.continuationToken;

                const requestOptions = {
                    method: 'GET',
                    params: {
                        maxResults: maxResultsUploadData,
                        ...(continuationToken && {
                            continuationToken: encodeURIComponent(continuationToken)
                        })
                    },
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                };

                const response = await axios(requestOptions);

                msg.payload = {
                    status: "Get Tables successful",
                    data: response.data.data,
                    continuationToken: response.data.continuationToken,
                    continuationUri: response.data.continuationUri,
                    requestedMaxResults: maxResultsUploadData
                };

                node.send(msg);
                node.oauth2Config.emit('http_request_completed');

            } catch (error) {
                handleError(node, error, msg);
            }
        }
        async function handleUpload(node, url, token, msg) {
            let requestBody = config.requestBody || msg.payload.requestBody;
            const filePath = msg.payload.filePath || config.filePath;
            const pathType = config.pathType || msg.payload.pathType;
            const modeType = config.modeType || msg.payload.modeType;
            const formatType = config.formatType || msg.payload.formatType;
            const delimiter =  msg.payload.delimiter || config.delimiter;
            const header = config.headerRow || msg.payload.headerRow;
            const tableName = config.tableName || msg.payload.tableName;
     
            if (!url) {
                node.error("No URL provided", msg);
                return;
            }
        
            let formatOptions = {
                "format": formatType.charAt(0).toUpperCase() + formatType.slice(1)
            };
          
            if (formatType.toUpperCase() === "CSV") {
                formatOptions.delimiter = delimiter; 
                formatOptions.header = Boolean(header);
            }
            requestBody = {
                "relativePath": filePath,
                "pathType": pathType.charAt(0).toUpperCase() + pathType.slice(1),
                "mode": modeType,
                "formatOptions": formatOptions
            };
            const requestOptions = {
                url: url+"/"+tableName+"/load",
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Content-Length': Buffer.byteLength(JSON.stringify(requestBody))
                },
                data: JSON.stringify(requestBody)
            };
        
            axios(requestOptions)
                .then(response => {
                    msg.payload = {
                        statusCode: response.status,
                        body: response.data
                    };
                    node.send(msg);
        
                    node.oauth2Config.emit('http_request_completed');
                })
                .catch(error => {
                    handleError(node, error, msg);
                });
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

    RED.nodes.registerType("upload-data", UploadDataNode);
};