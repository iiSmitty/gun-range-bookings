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
    // Set CORS headers - IMPORTANT FIX
    const headers = {
        'Access-Control-Allow-Origin': 'https://iismitty.github.io', // Allow all origins for testing, narrow down later
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        console.log("Handling OPTIONS preflight request");
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: "Preflight call successful" })
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
        console.log("Error parsing request body:", error);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid request body' })
        };
    }

    console.log("Request method:", event.httpMethod);
    console.log("Request params:", JSON.stringify(params));
    console.log("Request body:", event.body ? JSON.stringify(body) : "none");

    // GET: Fetch bookings (availability or user bookings)
    if (event.httpMethod === 'GET') {
        // Check if this is a password verification request
        if (event.path.endsWith('/verify')) {
            try {
                const { email, password } = params;

                if (!email || !password) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Email and password are required' })
                    };
                }

                console.log(`Verifying password for email: ${email}`);

                // Get bookings and verify password
                const { data, error } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('email', email.toLowerCase())
                    .eq('password_hash', password) // Make sure this field name matches your DB schema
                    .order('date', { ascending: true });

                if (error) {
                    console.error("Supabase error verifying password:", error);
                    throw error;
                }

                // If no bookings found with this email+password combo
                if (!data || data.length === 0) {
                    console.log("Invalid email or password");
                    return {
                        statusCode: 401,
                        headers,
                        body: JSON.stringify({ error: 'Invalid email or password' })
                    };
                }

                console.log(`Password verified, returning ${data.length} bookings`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(data)
                };
            } catch (error) {
                console.error('Error verifying password:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Failed to verify password' })
                };
            }
        }

        try {
            // If email is provided, get user bookings
            if (params.email) {
                console.log("Fetching bookings for email:", params.email);

                const { data, error } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('email', params.email.toLowerCase())
                    .order('date', { ascending: true });

                if (error) {
                    console.error("Supabase error:", error);
                    throw error;
                }

                console.log(`Returning ${data ? data.length : 0} bookings for user`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(data || [])
                };
            }

            // Otherwise get availability for date/range
            if (!params.date || !params.rangeType) {
                console.log("Missing date or rangeType parameters");
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Date and range type are required' })
                };
            }

            console.log(`Checking availability for ${params.date}, ${params.rangeType}`);
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('date', params.date)
                .eq('range_type', params.rangeType);

            if (error) {
                console.error("Supabase error:", error);
                throw error;
            }

            console.log(`Returning ${data ? data.length : 0} existing bookings`);
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
            const { name, email, date, rangeType, timeSlot, password_hash: password } = body;

            if (!name || !email || !date || !rangeType || !timeSlot || !password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'All fields including password are required' })
                };
            }

            if (!password || password.length < 4) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Password must be at least 4 characters' })
                };
            }

            console.log(`Creating booking for ${email} on ${date}, ${rangeType}, ${timeSlot}`);

            // Check current capacity
            const { data: existingBookings, error: checkError } = await supabase
                .from('bookings')
                .select('*')
                .eq('date', date)
                .eq('range_type', rangeType)
                .eq('time_slot', timeSlot);

            if (checkError) {
                console.error("Supabase error checking capacity:", checkError);
                throw checkError;
            }

            // Check capacity limits
            if (existingBookings.length >= MAX_CAPACITY[rangeType]) {
                console.log("Time slot is fully booked");
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
                        password_hash: password,  // Store the password
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) {
                console.error("Supabase error creating booking:", error);
                throw error;
            }

            console.log("Booking created successfully");
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
            const { id, email, password } = params;

            if (!id || !email || !password) {
                console.log("Missing required cancellation fields");
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Booking ID, email and password are required' })
                };
            }

            console.log(`Attempting to cancel booking ${id} for ${email} with password verification`);

            // Verify booking belongs to user and password is correct
            const { data: bookingData, error: fetchError } = await supabase
                .from('bookings')
                .select('*')
                .eq('id', id)
                .eq('email', email.toLowerCase())
                .eq('password_hash', password) // Make sure this matches your DB field name
                .single();

            if (fetchError) {
                console.log("Booking verification failed:", fetchError);
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid booking ID, email or password' })
                };
            }

            // Delete the booking
            const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("Supabase error deleting booking:", error);
                throw error;
            }

            console.log("Booking cancelled successfully with password verification");
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
    console.log(`Unsupported method: ${event.httpMethod}`);
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};