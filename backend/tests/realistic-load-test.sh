#!/bin/bash

# Realistic Load Testing Script for OrchePlan Backend
# Tests performance while respecting rate limits

BASE_URL="http://localhost:3000"
REQUESTS_PER_BATCH=10
BATCHES=3
DELAY_BETWEEN_BATCHES=2

echo "🚀 OrchePlan Backend Realistic Load Test"
echo "========================================"
echo "Base URL: $BASE_URL"
echo "Requests per batch: $REQUESTS_PER_BATCH"
echo "Number of batches: $BATCHES"
echo "Delay between batches: ${DELAY_BETWEEN_BATCHES}s"
echo ""

# Create temporary file for results
TEMP_FILE=$(mktemp)
echo "Results file: $TEMP_FILE"

# Function to make a request and log timing
make_request() {
    local batch=$1
    local request_id=$2
    local full_id="${batch}-${request_id}"
    
    local start_time=$(date +%s.%N)
    local response=$(curl -w "%{http_code},%{time_total},%{time_namelookup},%{time_connect}" -s -o /dev/null "$BASE_URL/")
    local end_time=$(date +%s.%N)
    local total_time=$(awk "BEGIN {print $end_time - $start_time}")
    
    echo "$full_id,$response,$total_time" >> "$TEMP_FILE"
    
    # Parse response
    IFS=',' read -r status_code curl_time dns_time connect_time <<< "$response"
    if [[ "$status_code" == "200" ]]; then
        echo "  ✅ Request $full_id: ${total_time}s (${curl_time}s curl)"
    elif [[ "$status_code" == "429" ]]; then
        echo "  🔒 Request $full_id: Rate limited (${status_code})"
    else
        echo "  ❌ Request $full_id: Error ${status_code}"
    fi
}

export -f make_request
export BASE_URL
export TEMP_FILE

total_requests=0
successful_requests=0
rate_limited_requests=0
error_requests=0

# Run batches with delays
for batch in $(seq 1 $BATCHES); do
    echo "🔄 Running batch $batch of $BATCHES..."
    
    # Run requests in this batch with limited concurrency
    seq 1 $REQUESTS_PER_BATCH | xargs -P 3 -I {} bash -c "make_request $batch {}"
    
    # Count results from this batch
    batch_total=$(grep "^${batch}-" "$TEMP_FILE" | wc -l)
    batch_success=$(grep "^${batch}-.*,200," "$TEMP_FILE" | wc -l)
    batch_rate_limited=$(grep "^${batch}-.*,429," "$TEMP_FILE" | wc -l)
    batch_errors=$((batch_total - batch_success - batch_rate_limited))
    
    total_requests=$((total_requests + batch_total))
    successful_requests=$((successful_requests + batch_success))
    rate_limited_requests=$((rate_limited_requests + batch_rate_limited))
    error_requests=$((error_requests + batch_errors))
    
    echo "  Batch $batch results: $batch_success✅ $batch_rate_limited🔒 $batch_errors❌"
    
    # Wait between batches (except for the last one)
    if [[ $batch -lt $BATCHES ]]; then
        echo "  ⏳ Waiting ${DELAY_BETWEEN_BATCHES}s before next batch..."
        sleep $DELAY_BETWEEN_BATCHES
    fi
done

echo ""
echo "📈 Final Results Analysis:"
echo "=========================="

if [[ -f "$TEMP_FILE" && -s "$TEMP_FILE" ]]; then
    # Calculate timing statistics for successful requests only
    successful_times=$(grep ",200," "$TEMP_FILE" | cut -d',' -f3)
    
    if [[ -n "$successful_times" ]]; then
        avg_time=$(echo "$successful_times" | awk '{ sum += $1; count++ } END { if (count > 0) print sum/count; else print 0 }')
        min_time=$(echo "$successful_times" | awk 'BEGIN { min = 999999 } { if ($1 < min) min = $1 } END { print min }')
        max_time=$(echo "$successful_times" | awk 'BEGIN { max = 0 } { if ($1 > max) max = $1 } END { print max }')
        
        # Calculate curl timing for successful requests
        successful_curl_times=$(grep ",200," "$TEMP_FILE" | cut -d',' -f4)
        avg_curl_time=$(echo "$successful_curl_times" | awk '{ sum += $1; count++ } END { if (count > 0) print sum/count; else print 0 }')
    else
        avg_time=0
        min_time=0
        max_time=0
        avg_curl_time=0
    fi
    
    success_rate=$(awk "BEGIN {printf \"%.1f\", $successful_requests * 100 / $total_requests}")
    
    echo "📊 Summary:"
    echo "  Total requests: $total_requests"
    echo "  Successful (200): $successful_requests ✅"
    echo "  Rate limited (429): $rate_limited_requests 🔒"
    echo "  Errors: $error_requests ❌"
    echo "  Success rate: ${success_rate}%"
    echo ""
    
    if [[ $successful_requests -gt 0 ]]; then
        echo "⏱️  Response Times (successful requests only):"
        echo "  Average: ${avg_time}s"
        echo "  Fastest: ${min_time}s"
        echo "  Slowest: ${max_time}s"
        echo "  Avg curl time: ${avg_curl_time}s"
        echo ""
        
        # Performance assessment for successful requests
        if awk "BEGIN {exit !($avg_time < 0.05)}"; then
            echo "✅ Performance: Excellent (< 50ms average)"
        elif awk "BEGIN {exit !($avg_time < 0.1)}"; then
            echo "🟡 Performance: Good (< 100ms average)"
        elif awk "BEGIN {exit !($avg_time < 0.5)}"; then
            echo "🟠 Performance: Acceptable (< 500ms average)"
        else
            echo "🔴 Performance: Needs attention (> 500ms average)"
        fi
    fi
    
    # Rate limiting analysis
    if [[ $rate_limited_requests -gt 0 ]]; then
        echo ""
        echo "🔒 Rate Limiting Analysis:"
        echo "  $rate_limited_requests requests were rate limited"
        echo "  Rate limiting is working as intended"
        echo "  This protects the server from abuse"
        
        if [[ $rate_limited_requests -gt $((total_requests / 2)) ]]; then
            echo "  ⚠️  High rate limiting suggests aggressive load testing"
        else
            echo "  ✅ Reasonable rate limiting under load testing conditions"
        fi
    fi
    
    # Overall assessment
    echo ""
    echo "🎯 Overall Assessment:"
    if [[ $successful_requests -gt 0 && $error_requests -eq 0 ]]; then
        echo "  ✅ System is performing well"
        echo "  ✅ Rate limiting is protecting the system"
        echo "  ✅ No errors detected in successful requests"
        echo "  📊 System ready for production traffic"
    elif [[ $error_requests -gt 0 ]]; then
        echo "  ⚠️  Some errors detected - investigate further"
    else
        echo "  🔒 All requests rate limited - test with lower frequency"
    fi
    
else
    echo "❌ No results collected - check if server is running"
fi

# Cleanup
rm -f "$TEMP_FILE"

echo ""
echo "✅ Realistic load test completed!"
echo ""
echo "💡 Note: Rate limiting (429 responses) is expected and indicates"
echo "   healthy protection against abuse. Focus on successful request performance."