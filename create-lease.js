const axios = require('axios');

module.exports = function (RED) {
    function CreateLeaseNode(config) {
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
            const action =  msg.payload.action || config.action;
            const url = msg.payload.url || config.url;
            const duration = msg.payload.leaseduration || config.leaseduration;
            const leaseid = msg.payload.leaseid || config.leaseid;
            const leaseidnew = msg.payload.leaseidnew || config.leaseidnew;

            if (!url) {
                return node.error(" URL is required");
            }

            if (action === "acquire") {
                await handleAcquire(node, url, token, msg,duration);
            }
            else if (action === "break") {
                await handleBreak(node, url, token, msg);
            }
            else if (action === "renew") {
                await handleRenew(node, url, token, msg,duration,leaseid);
            }
            else if (action === "release") {
                await handleRelease(node, url, token, msg,leaseid);
            }
            else if (action === "change") {
                await handleChange(node, url, token, msg,leaseid,leaseidnew);
            }
        }

        async function handleAcquire(node, url, token, msg,duration) {
            
            const requestOptions = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Length': 0,
                    'Authorization': `Bearer ${token}`,
                    'x-ms-lease-action': 'acquire',
                    'x-ms-lease-duration':duration,
                    'x-ms-proposed-lease-id':crypto.randomUUID(),
                }
            };


            axios(requestOptions)
                .then((response) => {
                    msg.payload = {
                        statusCode: response.status,
                        body: response.data,
                        headers: response.headers
                    };
                    node.send(msg);

                    node.oauth2Config.emit('http_request_completed');
                })
                .catch((error) => {
                    handleError(node, error, msg);
                });

        }
        async function handleBreak(node, url, token, msg) {
            
            const requestOptions = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Length': 0,
                    'Authorization': `Bearer ${token}`,
                    'x-ms-lease-action': 'break',
                }
            };


            axios(requestOptions)
                .then((response) => {
                    msg.payload = {
                        statusCode: response.status,
                        body: response.data,
                        headers: response.headers
                    };
                    node.send(msg);

                    node.oauth2Config.emit('http_request_completed');
                })
                .catch((error) => {
                    handleError(node, error, msg);
                });

        }
        async function handleRenew(node, url, token, msg,duration,leaseid) {
            
            const requestOptions = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Length': 0,
                    'Authorization': `Bearer ${token}`,
                    'x-ms-lease-action': 'renew',
                    'x-ms-lease-duration':duration,
                    'x-ms-lease-id':leaseid,
                }
            };


            axios(requestOptions)
                .then((response) => {
                    msg.payload = {
                        statusCode: response.status,
                        body: response.data,
                        headers: response.headers
                    };
                    node.send(msg);

                    node.oauth2Config.emit('http_request_completed');
                })
                .catch((error) => {
                    handleError(node, error, msg);
                });

        }
        async function handleRelease(node, url, token, msg,leaseid) {
            
            const requestOptions = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Length': 0,
                    'Authorization': `Bearer ${token}`,
                    'x-ms-lease-action': 'release',
                    'x-ms-lease-id':leaseid,
                }
            };


            axios(requestOptions)
                .then((response) => {
                    msg.payload = {
                        statusCode: response.status,
                        body: response.data,
                        headers: response.headers
                    };
                    node.send(msg);

                    node.oauth2Config.emit('http_request_completed');
                })
                .catch((error) => {
                    handleError(node, error, msg);
                });

        }
        async function handleChange(node, url, token, msg,leaseid,leaseidnew) {
            const requestOptions = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Length': 0,
                    'Authorization': `Bearer ${token}`,
                    'x-ms-lease-action': 'change',
                    'x-ms-lease-id':leaseid,
                    'x-ms-proposed-lease-id':leaseidnew,
                }
            };


            axios(requestOptions)
                .then((response) => {
                    msg.payload = {
                        statusCode: response.status,
                        body: response.data,
                        headers: response.headers
                    };
                    node.send(msg);

                    node.oauth2Config.emit('http_request_completed');
                })
                .catch((error) => {
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
    RED.nodes.registerType("create-lease", CreateLeaseNode);
};
