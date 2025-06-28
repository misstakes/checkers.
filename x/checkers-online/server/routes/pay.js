const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

// ENV credentials from .env
const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const shortcode = process.env.MPESA_SHORTCODE;
const passkey = process.env.MPESA_PASSKEY;
const callbackURL = process.env.MPESA_CALLBACK_URL;

// OAuth token helper
async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await axios.get(
  // ✅ Sandbox URL
'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
,
    {
      headers: { Authorization: `Basic ${auth}` }
    }
  );
  return response.data.access_token;
}

// POST /api/pay
router.post('/', async (req, res) => {
  let { phone, amount } = req.body;

  // Fallback to test values if not provided (for development)
  if (!phone || !amount) {
    phone = '254759606116';
    amount = 1;
  }

  // Validate phone number
  if (!/^07\d{8}$/.test(phone) && !/^2547\d{8}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number format. Use 07XXXXXXXX' });
  }

  const formattedPhone = phone.startsWith('07') ? phone.replace(/^0/, '254') : phone;
  amount = parseInt(amount);

  // Validate amount
  if (!Number.isInteger(amount) || amount < 1) {
    return res.status(400).json({ success: false, message: 'Amount must be a valid number (>= 1)' });
  }

  try {
    const accessToken = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

    const stkPushPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackURL,
      AccountReference: 'CheckersGame',
      TransactionDesc: 'Checkers Stake Payment'
    };

    const mpesaRes = await axios.post(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
,
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { ResponseCode, CustomerMessage } = mpesaRes.data;

    if (ResponseCode === '0') {
      return res.json({ success: true, message: CustomerMessage });
    } else {
      return res.status(500).json({
        success: false,
        message: mpesaRes.data.errorMessage || 'STK push rejected'
      });
    }
} catch (err) {
  console.error('🔥 M-Pesa API Error:', JSON.stringify(err.response?.data || err.message, null, 2));

  return res.status(500).json({
    success: false,
    message: err.response?.data?.errorMessage || err.response?.data || err.message || 'M-Pesa request failed'
  });
}


});

module.exports = router;
