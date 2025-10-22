#!/bin/bash

# Load Testing Script for OrchePlan Backend
# Tests concurrent load handling and measures performance metrics

BASE_URL="http://localhost:3000"
CONCURRENT_REQUESTS=10
TOTAL_REQUESTS=50

echo "🚀 OrchePlan Backend Load Test"
echo "=============================="
echo "Base URL: $BASE_URL"
echo "Concurrent requests: $CONCURRENT_REQUESTS"
echo "Total requests: $TOTAL_REQUESTS"
echo ""

echo "📊 Testing basic endpoint performance..."
# Test single request first
SINGLE_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$BASE_URL/")
echo "Single request time: ${SINGLE_TIME}s"
echo ""

echo "🔄 Testing concurrent load..."
# Create temporary file for results
TEMP_FILE=$(mktemp)

# Function to make a request and log timing
make_request() {
    local request_id=$1
    local start_time=$(date +%s.%N)
    local response=$(curl -w "%{http_code},%{time_total},%{time_namelookup},%{time_connect},%{time_pretransfer},%{time_starttransfer}" -s -o /dev/null "$BASE_URL/")
    local end_time=$(date +%s.%N)
    local total_time=$(awk "BEGIN {print $end_time - $start_time}")
    echo "$request_id,$response,$total_time" >> "$TEMP_FILE"
}

# Start concurrent requests
echo "Starting $TOTAL_REQUESTS requests with $CONCURRENT_REQUESTS concurrent..."
export -f make_request
export BASE_URL
export TEMP_FILE

# Use xargs to limit concurrent processes
seq 1 $TOTAL_REQUESTS | xargs -n 1 -P $CONCURRENT_REQUESTS -I {} bash -c 'make_request {}'

echo ""
echo "📈 Results Analysis:"
echo "==================="

# Analyze results
if [[ -f "$TEMP_FILE" && -s "$TEMP_FILE" ]]; then
    total_requests=$(wc -l < "$TEMP_FILE")
    success_count=$(awk -F, '$2 == 200 { count++ } END { print count+0 }' "$TEMP_FILE")
    error_count=$((total_requests - success_count))
    
    # Calculate timing statistics
    avg_time=$(awk -F, '{ sum += $3; count++ } END { if (count > 0) print sum/count; else print 0 }' "$TEMP_FILE")
    min_time=$(awk -F, 'BEGIN { min = 999999 } { if ($3 < min) min = $3 } END { print min }' "$TEMP_FILE")
    max_time=$(awk -F, 'BEGIN { max = 0 } { if ($3 > max) max = $3 } END { print max }' "$TEMP_FILE")
    
    # Calculate curl-specific timings
    avg_curl_time=$(awk -F, '{ sum += $4; count++ } END { if (count > 0) print sum/count; else print 0 }' "$TEMP_FILE")
    avg_connect_time=$(awk -F, '{ sum += $6; count++ } END { if (count > 0) print sum/count; else print 0 }' "$TEMP_FILE")
    avg_transfer_time=$(awk -F, '{ sum += $8; count++ } END { if (count > 0) print sum/count; else print 0 }' "$TEMP_FILE")
    
    echo "📊 Summary:"
    echo "  Total requests: $total_requests"
    echo "  Successful (200): $success_count"
    echo "  Errors: $error_count"
    echo "  Success rate: $(awk "BEGIN {printf \"%.1f\", $success_count * 100 / $total_requests}")%"
    echo ""
    echo "⏱️  Response Times:"
    echo "  Average: ${avg_time}s"
    echo "  Fastest: ${min_time}s"
    echo "  Slowest: ${max_time}s"
    echo ""
    echo "🔧 Connection Details:"
    echo "  Avg curl time: ${avg_curl_time}s"
    echo "  Avg connect time: ${avg_connect_time}s"
    echo "  Avg transfer time: ${avg_transfer_time}s"
    echo ""
    
    # Performance assessment using awk instead of bc
    if awk "BEGIN {exit !($avg_time < 0.1)}"; then
        echo "✅ Performance: Excellent (< 0.1s average)"
    elif awk "BEGIN {exit !($avg_time < 0.5)}"; then
        echo "🟡 Performance: Good (< 0.5s average)"
    elif awk "BEGIN {exit !($avg_time < 1.0)}"; then
        echo "🟠 Performance: Acceptable (< 1.0s average)"
    else
        echo "🔴 Performance: Needs attention (> 1.0s average)"
    fi
    
    if [[ $error_count -gt 0 ]]; then
        echo "⚠️  Detected $error_count failed requests"
        echo "   This could indicate rate limiting or server overload"
    fi
    
    # Show slowest requests
    slow_requests=$(awk -F, '$3 > 0.5 { count++ } END { print count+0 }' "$TEMP_FILE")
    if [[ $slow_requests -gt 0 ]]; then
        echo "🐌 $slow_requests requests took longer than 0.5s"
    fi
    
else
    echo "❌ No results collected - check if server is running"
fi

# Cleanup
rm -f "$TEMP_FILE"

echo ""
echo "✅ Load test completed!"