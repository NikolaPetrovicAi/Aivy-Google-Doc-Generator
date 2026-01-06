// backend/google/docActions.js
const { google } = require("googleapis");
const { oauth2Client } = require("./auth");
const { htmlToGoogleDocsRequests } = require("./htmlToGoogleDocsRequests.js");

async function updateGoogleDocContent(documentId, htmlContent, title) {
    const docs = google.docs({ version: "v1", auth: oauth2Client });
    const drive = google.drive({ version: "v3", auth: oauth2Client });
  
    // First, fetch the current document to get its title
    const currentDoc = await docs.documents.get({ documentId });
  
    // 1. Handle Title Update separately using the Drive API
    if (title && title !== currentDoc.data.title) {
      console.log(`Updating title to: "${title}"`);
      await drive.files.update({
        fileId: documentId,
        resource: { name: title },
        fields: 'name'
      });
      console.log(`✅ Document title updated successfully.`);
    }
  
    // 2. Handle Content Update using a "delete all, then insert all" strategy
    const deletionRequests = [];
    const content = currentDoc.data.body.content;
    
    if (content) {
        const lastElement = content[content.length - 1];
        if (lastElement && lastElement.endIndex > 2) {
          // Create a request to delete all existing content from index 1 to the end
          deletionRequests.push({
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: lastElement.endIndex - 1,
              },
            },
          });
        }
    }
  
    // Use the HTML converter to get requests for the new content
    const { requests: insertionRequests } = htmlToGoogleDocsRequests(htmlContent);
  
    // Combine deletion and insertion requests into a single batch
    const allRequests = [...deletionRequests, ...insertionRequests];
    
    if (allRequests.length > 0) {
      console.log(`Executing batch update with ${allRequests.length} requests.`);
      try {
        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
              requests: allRequests,
            },
        });
      } catch (e) {
        // Log the detailed error for better debugging
        console.error("Error during batchUpdate:", JSON.stringify(e.errors, null, 2));
        throw e;
      }
    }
  
    console.log(`✅ Document ${documentId} content updated successfully.`);
}

module.exports = { updateGoogleDocContent };
