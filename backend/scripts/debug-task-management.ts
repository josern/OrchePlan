#!/usr/bin/env ts-node

/**
 * Task Management Debug Script
 * Tests task creation functionality to identify issues
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function debugTaskManagement() {
    console.log('🔍 Debugging Task Management Functionality\n');
    
    // Step 1: Test server connectivity
    console.log('1. Testing server connectivity...');
    try {
        const healthCheck = await axios.get(`${BASE_URL}/`);
        console.log('✅ Server is responding:', healthCheck.data);
    } catch (error) {
        console.log('❌ Server connectivity failed:', error.message);
        return;
    }
    
    // Step 2: Test CSRF token endpoint
    console.log('\n2. Testing CSRF token endpoint...');
    let cookies = '';
    try {
        const csrfResponse = await axios.get(`${BASE_URL}/csrf-token`);
        console.log('✅ CSRF token received:', csrfResponse.data);
        
        // Extract cookies from response
        const setCookieHeader = csrfResponse.headers['set-cookie'];
        if (setCookieHeader) {
            cookies = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
            console.log('📝 Cookies extracted:', cookies);
        }
    } catch (error) {
        console.log('❌ CSRF token failed:', error.message);
    }
    
    // Step 3: Test authentication with existing user
    console.log('\n3. Testing authentication...');
    let authCookies = '';
    try {
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'andreas@josern.com',
            password: 'your-password-here' // Need actual password
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            },
            withCredentials: true
        });
        
        console.log('✅ Login successful:', loginResponse.data);
        
        // Extract auth cookies
        const setCookieHeader = loginResponse.headers['set-cookie'];
        if (setCookieHeader) {
            authCookies = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
            console.log('🔐 Auth cookies extracted:', authCookies);
        }
    } catch (error) {
        console.log('❌ Authentication failed:', error.response?.data || error.message);
        console.log('⚠️  Skipping task tests - no valid authentication');
        return;
    }
    
    // Step 4: Test task listing (GET /tasks)
    console.log('\n4. Testing task listing...');
    try {
        const tasksResponse = await axios.get(`${BASE_URL}/tasks?projectId=test-project`, {
            headers: {
                'Cookie': authCookies
            },
            withCredentials: true
        });
        console.log('✅ Task listing successful:', tasksResponse.data);
    } catch (error) {
        console.log('❌ Task listing failed:', error.response?.data || error.message);
    }
    
    // Step 5: Test task creation (POST /tasks)
    console.log('\n5. Testing task creation...');
    try {
        // Get fresh CSRF token for POST request
        const csrfResponse = await axios.get(`${BASE_URL}/csrf-token`, {
            headers: { 'Cookie': authCookies },
            withCredentials: true
        });
        
        const csrfToken = csrfResponse.data.csrfToken;
        console.log('🔒 CSRF token for POST:', csrfToken);
        
        const taskData = {
            title: 'Debug Test Task',
            description: 'This is a test task created for debugging',
            projectId: 'test-project-id', // This needs to be a valid project ID
            priority: 'medium'
        };
        
        const createResponse = await axios.post(`${BASE_URL}/tasks`, taskData, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': authCookies,
                'X-CSRF-Token': csrfToken
            },
            withCredentials: true
        });
        
        console.log('✅ Task creation successful:', createResponse.data);
    } catch (error) {
        console.log('❌ Task creation failed:');
        console.log('   Status:', error.response?.status);
        console.log('   Data:', error.response?.data);
        console.log('   Headers:', error.response?.headers);
    }
    
    console.log('\n🔍 Debug complete!');
}

if (require.main === module) {
    debugTaskManagement().catch(console.error);
}

export default debugTaskManagement;