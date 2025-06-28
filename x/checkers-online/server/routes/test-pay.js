// server/routes/test-pay.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Hard-coded sandbox credentials (replace with your own to test)
const consumerKey    = 'bLmEtTbR1WUXSLw34m3tjJOEzMPxgpd7dZpLlf86BeJSgLON';
const consumerSecret = 's2r2HPTBFxw8dEtI1fIGGa1hXDoRp9muL7GvDAHuAGGZMGsUhnCUb8qCipmDqND8';
const shortcode      = '174379'; // sandbox PayBill
const passkey        = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const callbackURL    = 'https://example.com/callback'; // your ngrok or live HTTPS endpoint

// Helper to get an OAuth token
async function getAccessToken() {
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const resp = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return resp.data.access_token;
}

router.post('/', async (req, res) => {
  try {
    // For a quick test we're hard-coding phone+amount here:
    const testPhone  = '254759606116';
    const testAmount = 1;

    const accessToken = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password  = Buffer.from(shortcode + passkey + timestamp).toString('base64');

    const payload = {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            testAmount,
      PartyA:            testPhone,
      PartyB:            shortcode,
      PhoneNumber:       testPhone,
      CallBackURL:       callbackURL,
      AccountReference:  'CheckersApp',
      TransactionDesc:   'Test STK Push'
    };

    const mpesaRes = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // Return the raw MPESA response JSON
    res.json(mpesaRes.data);

  } catch (err) {
    console.error('M-Pesa Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

module.exports = router;
