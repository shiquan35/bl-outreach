import axios from "axios";

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

export const sendWhatsapp = async ({
  phoneNumber,
  message,
  mediaURLs,
}: {
  phoneNumber: string;
  message: string;
  mediaURLs: string[];
}) => {
  // Send text message
  try {
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Send each media URL as a separate image message
    // for (const url of mediaURLs) {
    //   await axios.post(
    //     WHATSAPP_API_URL,
    //     {
    //       messaging_product: "whatsapp",
    //       to: phoneNumber,
    //       type: "image",
    //       image: { link: url },
    //     },
    //     {
    //       headers: {
    //         Authorization: `Bearer ${ACCESS_TOKEN}`,
    //         "Content-Type": "application/json",
    //       },
    //     }
    //   );
    // }
  } catch (error) {
    // console.error("Error sending WhatsApp message:", error);
    throw new Error("Failed to send WhatsApp message");
  }
};
