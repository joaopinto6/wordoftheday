const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  // Check if the request is a POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email } = JSON.parse(event.body);
    
    // Validate email
    if (!email || !validateEmail(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Supabase credentials not configured' })
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Insert email into Supabase
    const { data, error } = await supabase
      .from('subscribers')
      .insert([{ email, subscribed_at: new Date() }]);
      
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'This email is already subscribed' })
        };
      }
      
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save email' })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Email subscribed successfully' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}
