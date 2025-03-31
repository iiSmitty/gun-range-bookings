const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Configuration
const MAX_CAPACITY = {
    ".22 Range": 5,  // 5 people per time slot
    "Rifle Range": 3 // 3 people per time slot
};

exports.handler = async function(event, context) {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': 'https://iismitty.github.io/gun-range-bookings/', // In production, set this to your GitHub Pages URL
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Parse query parameters and body
    const params = event.queryStringParameters || {};
    let body = {};

    try {
        if (event.body) {
            body = JSON.parse(event.body);
        }
    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid request body' })
        };
    }

    // GET: Fetch bookings (availability or user bookings)
    if (event.httpMethod === 'GET') {
        try {
            // If email is provided, get user bookings
            if (params.email) {
                const { data, error } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('email', params.email.toLowerCase())
                    .order('date', { ascending: true });

                if (error) throw error;

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(data || [])
                };
            }

            // Otherwise get availability for date/range
            if (!params.date || !params.rangeType) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Date and range type are required' })
                };
            }

            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('date', params.date)
                .eq('range_type', params.rangeType);

            if (error) throw error;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data || [])
            };
        } catch (error) {
            console.error('Error fetching bookings:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to fetch bookings' })
            };
        }
    }

    // POST: Create a new booking
    if (event.httpMethod === 'POST') {
        try {
            const { name, email, date, rangeType, timeSlot } = body;

            if (!name || !email || !date || !rangeType || !timeSlot) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'All fields are required' })
                };
            }

            // Check current capacity
            const { data: existingBookings, error: checkError } = await supabase
                .from('bookings')
                .select('*')
                .eq('date', date)
                .eq('range_type', rangeType)
                .eq('time_slot', timeSlot);

            if (checkError) throw checkError;

            // Check capacity limits
            if (existingBookings.length >= MAX_CAPACITY[rangeType]) {
                return {
                    statusCode: 409,
                    headers,
                    body: JSON.stringify({ error: 'This time slot is fully booked' })
                };
            }

            // Create booking
            const { data, error } = await supabase
                .from('bookings')
                .insert([
                    {
                        name,
                        email: email.toLowerCase(),
                        date,
                        range_type: rangeType,
                        time_slot: timeSlot,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) throw error;

            return {
                statusCode: 201,
                headers,
                body: JSON.stringify(data[0])
            };
        } catch (error) {
            console.error('Error creating booking:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to create booking' })
            };
        }
    }

    // DELETE: Cancel a booking
    if (event.httpMethod === 'DELETE') {
        try {
            const { id, email } = params;

            if (!id || !email) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Booking ID and email are required' })
                };
            }

            // Verify the booking belongs to this user
            const { data: bookingData, error: fetchError } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', id)
                .eq('email', email.toLowerCase())
                .single();

            if (fetchError) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Booking not found or not authorized' })
                };
            }

            // Delete the booking
            const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        } catch (error) {
            console.error('Error deleting booking:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to delete booking' })
            };
        }
    }

    // Handle unsupported methods
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};