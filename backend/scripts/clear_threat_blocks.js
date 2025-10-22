#!/usr/bin/env node

/**
 * Quick script to clear all threat detection blocks
 * Run this if the threat detection system is blocking legitimate requests
 */

const http = require('http');

const clearBlocks = () => {
  const postData = JSON.stringify({});
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/threats/clear-all',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      // You'll need to add proper authentication here
      // 'Authorization': 'Bearer your-jwt-token'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
      if (res.statusCode === 200) {
        console.log('✅ Successfully cleared all threat detection blocks');
      } else {
        console.log('❌ Failed to clear blocks. Status:', res.statusCode);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error clearing blocks:', e.message);
    console.log('💡 Make sure the backend server is running on port 3001');
  });

  req.write(postData);
  req.end();
};

console.log('🔧 Attempting to clear threat detection blocks...');
clearBlocks();