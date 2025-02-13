const axios = require('axios');
const fs = require('fs');

module.exports = function (RED) {
    function DataRequestsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.oauth2Config = RED.nodes.getNode(config.oauth2);

        if (!node.oauth2Config) {
            return node.error("Missing OAuth2 configuration node");
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
            const filePath = msg.payload.filePath || config.filePath;
            const overwrite = msg.payload.overwrite || config.overwrite;
            const maxResults = msg.payload.maxResults || config.maxResults;
            const recursive = msg.payload.recursive || config.recursive;

            if (!url) {
                return node.error(" URL is required");
            }

            if (action === "create") {
                await handleCreate(node, url, token, msg);
            }
            else if (action === "delete") {
                await handleDelete(node, url, token, msg);
            }
            else if (action === "read") {
                await handleRead(node, url, token, msg);
            }
            else if (action === "getproperties") {
                await handleGetProperties(node, url, token, msg);
            }
            else if (action === "list") {
                await handleList(node, url, token, msg, maxResults, recursive);
            }
            else if (action === "update") {
                if (overwrite) {
                    await handleOverwrite(node, url, filePath, token, msg);
                } else {
                    await handleAppend(node, url, filePath, token, msg);
                }
            }
        }

        async function handleCreate(node, url, token, msg) {
            try {
                const requestOptions = {
                    method: 'PUT',
                    url: url,
                    params: { resource: 'file' },
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Length': 0,
                        'Authorization': `Bearer ${token}`
                    }
                };
                const response = await axios(requestOptions);
                msg.payload = {
                    statusCode: response.status,
                    data: response.data
                };
                node.send(msg);

                node.oauth2Config.emit('http_request_completed');
            }
            catch (error) {
                handleError(node, error, msg);
            }




        }
        async function handleDelete(node, url, token, msg) {
            try {
                const requestOptions = {
                    method: 'DELETE',
                    url: url,
                    headers: {
                        'Content-Length': 0,
                        'Authorization': `Bearer ${token}`
                    }
                };
                const response = await axios(requestOptions);
                msg.payload = {
                    statusCode: response.status,
                    data: response.data
                }
                node.send(msg);
                node.oauth2Config.emit('http_request_completed');
            }
            catch (error) {
                handleError(node, error, msg);
            }


        }
        async function handleRead(node, url, token, msg) {
            try {
                const requestOptions = {
                    method: 'GET',
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                };
                const response = await axios(requestOptions);
                msg.payload = {
                    status: "Get File successful",
                    data: response.data,
                    headers: response.headers,
                    statusCode: response.status
                };

                node.send(msg);
                node.oauth2Config.emit('http_request_completed');
            } catch (error) {

                handleError(node, error, msg);
            };

        }
        async function handleGetProperties(node, url, token, msg) {
            try {
                const requestOptions = {
                    method: 'HEAD',
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                };

                const response = await axios(requestOptions);

                msg.payload = {
                    status: "Get Properties successful",
                    headers: response.headers,
                    statusCode: response.status
                };

                node.send(msg);
                node.oauth2Config.emit('http_request_completed');

            } catch (error) {
                handleError(node, error, msg);
            }
        }
        async function handleList(node, url, token, msg, maxResults, recursive) {
            try {
                const continuationToken = msg.headers?.['x-ms-continuation'];

                const requestOptions = {
                    method: 'GET',
                    params: {
                        recursive: recursive,
                        resource: 'filesystem',
                        maxResults: maxResults,
                        ...(continuationToken && { continuation: continuationToken })
                    },
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                };



                const response = await axios(requestOptions);

                msg.payload = {
                    status: "Get List successful",
                    data: response.data,
                    headers: response.headers,
                    requestedMaxResults: maxResults
                };

                if (response.headers['x-ms-continuation']) {
                    msg.headers = {
                        'x-ms-continuation': response.headers['x-ms-continuation']
                    };
                } else {
                    msg.headers = { 'x-ms-continuation': null };
                }

                node.send(msg);
                node.oauth2Config.emit('http_request_completed');

            } catch (error) {
                handleError(node, error, msg);
            }
        }
        async function handleAppend(node, url, filePath, token, msg) {
            try {

                const stats = fs.statSync(filePath);
                const headResponse = await axios.head(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const remoteDocumentSize = parseInt(headResponse.headers['content-length']);

                await axios.patch(url, fs.createReadStream(filePath), {
                    params: { action: 'append', position: remoteDocumentSize },
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Authorization': `Bearer ${token}`,
                        'Content-Length': stats.size
                    }
                });

                await axios.patch(url, null, {
                    params: { action: 'flush', position: remoteDocumentSize + stats.size },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                msg.payload = { status: "Append successful" };
                node.send(msg);
            } catch (error) {
                handleError(node, error, msg);
            }
        }

        async function handleOverwrite(node, url, filePath, token, msg) {
            try {

                const stats = fs.statSync(filePath);

                await axios.put(url, null, {
                    params: { resource: 'file' },
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Authorization': `Bearer ${token}`
                    }
                });

                await axios.patch(url, fs.createReadStream(filePath), {
                    params: { action: 'append', position: 0 },
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Authorization': `Bearer ${token}`,
                        'Content-Length': stats.size
                    }
                });

                await axios.patch(url, null, {
                    params: { action: 'flush', position: stats.size },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                msg.payload = { status: "Overwrite successful" };
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

    RED.nodes.registerType("data-requests", DataRequestsNode);
};
