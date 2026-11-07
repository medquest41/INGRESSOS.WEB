import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'customer-contact.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:5224',channel:'chrome',headless:true},outputDir:'test-results-customer-contact',reporter:'list'})
