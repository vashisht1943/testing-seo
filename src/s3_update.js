import puppeteer from "puppeteer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
// Set up S3 client with environment variables
const s3 = new S3Client({
  region: process.env.MY_AWS_REGION,
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
});

const bucket_name = process.env.S3_BUCKET_NAME;
const base_url = process.env.BASE_URL || "https://demo1.sourcerer.tech/";
const default_routes = [
  "all-products",
  "all-products/category",
  "all-products/collection",
];

// Helper function to make API requests
async function api_service(endpoint) {
  try {
    const url = `${process.env.BASE_API_URL}${endpoint}`;
    const response = await axios.get(url, {
      headers: {
        "tenant-id": process.env.TENANT_ID,
        "Content-Type": "application/json",
        channel: "wizshop",
      },
    });
    return response;
  } catch (error) {
    console.error(`Failed to fetch data from API endpoint ${endpoint}:`, error);
    return null;
  }
}

// Fetch category routes
async function fetch_category_routes() {
  try {
    const response = await api_service("/wizshop/v1/category/");
    const categories = response?.data;
    return categories?.data?.map(
      (category) =>
        `all-products/category/product/${category?.name}/${category?.id}`
    );
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Fetch collection routes
async function fetch_collection_routes() {
  try {
    const response = await api_service("/wizshop/v1/collection/");
    const collections = response?.data;
    return collections?.data?.map(
      (collection) =>
        `all-products/collection/product/${collection?.name}/${collection?.id}`
    );
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Upload HTML content to S3
async function upload_to_s3(content, file_name) {
  try {
    const params = {
      Bucket: bucket_name,
      Key: file_name,
      Body: content,
      ContentType: "text/html",
    };
    const command = new PutObjectCommand(params);
    await s3.send(command);
    console.log(`File uploaded successfully to S3: ${file_name}`);
  } catch (error) {
    console.error(`Failed to upload file to S3: ${error}`);
  }
}

// Save HTML content of a page to S3
async function save_html_content(browser, page_url, route) {
  const page = await browser.newPage();
  try {
    await page.goto(page_url, { waitUntil: "networkidle2" });
    await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait for page to fully load

    const html_content = await page.content();
    const sanitized_file_name = route.replace(/[?&=/*]/g, "_") + ".html";
    console.log(
      `HTML page for ${route} saved successfully as ${sanitized_file_name}.`
    );

    await upload_to_s3(html_content, sanitized_file_name);
  } catch (error) {
    console.error(`Failed to fetch page for ${route}:`, error);
  } finally {
    await page.close();
  }
}

// Main function to run the process
// async function main() {
//   let browser = null;
//   try {
//     browser = await puppeteer.launch({
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//       headless: true,
//     });

//     const category_routes = await fetch_category_routes();
//     const collection_routes = await fetch_collection_routes();
//     const routes = [
//       ...default_routes,
//       ...category_routes,
//       ...collection_routes,
//     ];
//     console.log("Routes to process:", routes);

//     for (const route of routes) {
//       const page_url = `${base_url}${route}`;
//       await save_html_content(browser, page_url, route);
//     }

//     console.log("All product pages have been processed and saved.");
//   } catch (error) {
//     console.error("Error launching browser:", error);
//   } finally {
//     if (browser !== null) {
//       await browser.close();
//     }
//   }
// }

// // Run the main function
// main().catch((error) => console.error("Script failed with error:", error));
// import fs from 'fs';
// import path from 'path';

// function createHtmlFile() {
//   // Get the current date and time in UTC
//   const now = new Date();

//   // Convert to IST by adding 5 hours and 30 minutes
//   const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
//   const istTime = new Date(now.getTime() + istOffset);

//   // Format IST time for the file name (HH-MM-SS only)
//   const hours = String(istTime.getUTCHours()).padStart(2, '0');
//   const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
//   const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
//   const timestamp = `${hours}-${minutes}`;

//   // Define the file name and content without year, month, or day
//   const fileName = `html_${timestamp}_IST.html`;
//   const directoryPath = path.join('.', 'html-content'); // Use relative path
  
//   const filePath = path.join(directoryPath, fileName);

//   // Define HTML content with only time in IST
//   const htmlContent = `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <title>Timestamped HTML File</title>
//     </head>
//     <body>
//       <h1>File created at: ${hours}:${minutes}:${seconds} (IST)</h1>
//     </body>
//     </html>
//   `;

//   // Check if directory exists, create if it doesn't
//   if (!fs.existsSync(directoryPath)) {
//     fs.mkdirSync(directoryPath);
//   }
//   upload_to_s3(htmlContent, fileName)
//   // Write the HTML content to the file
//   fs.writeFile(filePath, htmlContent, (err) => {
//     if (err) {
//       console.error("Error creating HTML file:", err);
//     } else {
//       console.log("HTML file created:", fileName);
//     }
//   });
// }

// // Call the function to create the file
// createHtmlFile();
