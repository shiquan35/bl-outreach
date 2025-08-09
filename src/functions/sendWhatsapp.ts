import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER!;

const client = twilio(accountSid, authToken);

export const sendWhatsapp = async ({
  phoneNumber,
  message,
  mediaURLs,
}: {
  phoneNumber: string;
  message: string;
  mediaURLs: string[];
}) => {
  try {
    // Format phone number for Twilio WhatsApp (add whatsapp: prefix)
    const formattedPhoneNumber = phoneNumber.startsWith("whatsapp:")
      ? phoneNumber
      : `whatsapp:${phoneNumber}`;

    // Ensure from number has whatsapp: prefix
    const formattedFromNumber = fromNumber.startsWith("whatsapp:")
      ? fromNumber
      : `whatsapp:${fromNumber}`;

    // Send text message
    await client.messages.create({
      body: message,
      from: formattedFromNumber,
      to: formattedPhoneNumber,
    });

    // Send each media URL as a separate message
    for (const url of mediaURLs) {
      await client.messages.create({
        body: "", // Optional: you can add a caption here
        mediaUrl: [url],
        from: formattedFromNumber,
        to: formattedPhoneNumber,
      });
    }
  } catch (error) {
    console.error("Error sending WhatsApp message via Twilio:", error);
    throw new Error("Failed to send WhatsApp message via Twilio");
  }
};
