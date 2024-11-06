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
async function main() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });

    const category_routes = await fetch_category_routes();
    const collection_routes = await fetch_collection_routes();
    const routes = [
      ...default_routes,
      ...category_routes,
      ...collection_routes,
    ];
    console.log("Routes to process:", routes);

    for (const route of routes) {
      const page_url = `${base_url}${route}`;
      await save_html_content(browser, page_url, route);
    }

    console.log("All product pages have been processed and saved.");
  } catch (error) {
    console.error("Error launching browser:", error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}

// Run the main function
main().catch((error) => console.error("Script failed with error:", error));
