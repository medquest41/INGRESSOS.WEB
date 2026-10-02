import { defineConfig } from '@playwright/test'
export default defineConfig({testDir:'./tests',testMatch:'**/*.spec.js',fullyParallel:false,workers:1,timeout:45000,use:{baseURL:process.env.TEST_URL || 'http://localhost:5173',headless:true,channel:process.env.TEST_BROWSER || 'chrome',screenshot:'only-on-failure',trace:'retain-on-failure'},reporter:'list'})
