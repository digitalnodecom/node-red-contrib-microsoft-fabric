
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# NodeRed Data Requests Node Documentation

## Overview
A versatile Node for interacting with Microsoft Fabric Lakehouse files through various operations.

## Node Configuration Fields

### 1. OAuth2 Configuration
- **Purpose**: Secure authentication for Lakehouse access
- **Requirement**: Mandatory for all operations
- **How to Set Up**: Configure a separate OAuth2 credentials node

### 2. URL
- **Purpose**: Specifies the exact file or directory path in Lakehouse
- **Format**: `https://onelake.dfs.fabric.microsoft.com/{workspaceID}/{lakehouseID}/Files/{filename}`


### 3. Action Dropdown
Choose from:
- **Create**: Initialize a new empty file
- **Delete**: Remove an existing file
- **Read**: Retrieve file contents
- **Get Properties**: Fetch file metadata
- **List**: Explore files in a directory
- **Update**: Modify existing file contents

### 4. File Path (for Update action)
- **Purpose**: Local file to upload or append
- **Requirement**: Needed only for Update action
- **Example**: `C:\Users\YourName\Documents\data.csv`

### 5. Overwrite Checkbox (Update action)
- **Purpose**: Control file modification behavior
- - **Checked**: Replace entire file contents
- **Unchecked**: Append to existing file

### 6. Max Results (List action)
- **Purpose**: Limit number of files returned
- **Default**: 5000 items
- **Use Case**: Pagination for large directories

### 7. Recursive (List action)
- **Purpose**: Control directory listing depth
- **Checked**: List files in all subdirectories
- **Unchecked**: List only root-level files

## Typical Workflow
1. Configure OAuth2 credentials
2. Set target Lakehouse URL
3. Choose appropriate action
4. Configure optional parameters
5. Connect to subsequent nodes for processing



## References
- [Microsoft Fabric Storage API Documentation](https://learn.microsoft.com/en-us/rest/api/storageservices/data-lake-storage-gen2)
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# NodeRed Lease Management Node Documentation

## Overview
A specialized Node for managing file leases in Microsoft Fabric Lakehouse, providing granular control over file access.

## Configuration Fields

### 1. OAuth2 Configuration
- **Purpose**: Secure authentication for lease operations
- **Requirement**: Mandatory for all lease actions

### 2. URL
- **Purpose**: Specify exact file path in Lakehouse
- **Format**: `https://{accountName}.{dnsSuffix}/{filesystem}/{path}`

### 3. Lease Actions
#### Create Lease
- **Fields**:
  - **Lease Duration**: 
    - Required
    - Range: 15-60 seconds or -1 (infinite)
    - Controls lease lock period

#### Change Lease
- **Fields**:
  - **Current Lease ID**: Existing lease identifier
  - **New Lease ID**: Replacement lease identifier
  - **Lease Duration**: New lease time frame

#### Break Lease
- **Purpose**: Interrupts current lease
- **Outcome**: Provides interval before new lease can be acquired

#### Renew Lease
- **Fields**:
  - **Lease ID**: Current active lease
  - **Lease Duration**: Extended lease time

#### Release Lease
- **Fields**:
  - **Lease ID**: Lease to be terminated



## References
- [Microsoft Lease Management Documentation](https://learn.microsoft.com/en-us/rest/api/storageservices/lease-container)
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Data Automation Node Documentation

## Purpose
Uploads local files directly to Microsoft Fabric Lakehouse with a single-step process.

## Configuration Requirements

### 1. OAuth2 Configuration
- **Purpose**: Secure authentication for file upload
- **Mandatory**: Yes

### 2. URL
- **Format**: `https://{accountName}.{dnsSuffix}/{filesystem}/{path}`
- **Example**: `https://onelake.dfs.fabric.microsoft.com/workspace/lakehouse/Files/mydata.csv`

### 3. Local File Path
- **Purpose**: Source file for upload
- **Example**: `C:/Users/exampleUser/exampleDesktop/exampleFile.csv`
- **Supports**: CSV, text, and other file types

## Workflow
1. Authenticate via OAuth2
2. Create file in Lakehouse
3. Append file contents
4. Finalize (flush) file upload


-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
# Upload Data Node Documentation

## Overview
Facilitates table management and data loading in Microsoft Fabric Lakehouse.

## Configuration Requirements

### OAuth2 Configuration
- **Purpose**: Secure authentication
- **Mandatory**: Yes

### URL Formats
- **List Tables**: `https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables`
- **Upload Table**: `https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables`

## Actions

### 1. List Tables
- **Purpose**: Retrieve Lakehouse table inventory
- **Parameters**:
  - `MaxResultsUploadData`: Controls pagination
  - Default: Up to 5000 items per request
  - **Continuation Token**: Used for paginated requests

### 2. Upload Table
- **Purpose**: Load data into an existing Lakehouse table
- **Requirement**: Preexisting data file
  - Supports **CSV** and **Parquet**
  - Configurable **Delimiter** and **Header Row** for CSV files
  - Allows defining **Path Type**, **Mode Type**, and **Format Type**

#### Upload Table Parameters
- **File Path**: Local file path to upload
- **Path Type**: Specifies relative or absolute path
- **Mode Type**: Defines data loading mode
- **Format Type**: Supports multiple file formats
- **Delimiter**: Used for CSV format
- **Header Row**: Boolean flag to include header
- **Table Name**: Target table for data loading

## Error Handling
- Improved logging for API request failures
- Handles missing access token by initiating a local OAuth2 server
- Detailed error messages for request failures

## References
- [Microsoft Fabric Lakehouse Tables API](https://learn.microsoft.com/en-us/rest/api/fabric/lakehouse/tables)

