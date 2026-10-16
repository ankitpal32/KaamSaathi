import { TradeType, VoiceDraftJob } from '../types';

// Check if browser supports Web Speech API
export const isSpeechRecognitionSupported = (): boolean => {
  return typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
};

export interface ExtractedEntities {
  customerName: string;
  customerPhone: string;
  trade: TradeType;
  description: string;
  agreedAmount: number;
  amountPaid: number;
  remainingBalance: number;
  notes: string;
}

export const parseVoiceInput = (rawTranscript: string): ExtractedEntities => {
  const text = rawTranscript.trim();
  
  // Default values
  let customerName = 'Walk-in Customer';
  let customerPhone = '+91 ';
  let trade: TradeType = 'electrical';
  let description = text;
  let agreedAmount = 0;
  let amountPaid = 0;
  let notes = 'Logged via voice assistant';

  // 1. Detect Trade keywords (English & Bengali)
  const lower = text.toLowerCase();
  if (
    lower.includes('fan') || 
    lower.includes('wiring') || 
    lower.includes('switch') || 
    lower.includes('light') || 
    lower.includes('fuse') || 
    lower.includes('mcb') || 
    lower.includes('inverter') || 
    lower.includes('electrical') ||
    text.includes('ফ্যান') ||
    text.includes('সুইচ') ||
    text.includes('ফিউজ') ||
    text.includes('ইলেকট্রিক')
  ) {
    trade = 'electrical';
  } else if (
    lower.includes('pipe') || 
    lower.includes('leak') || 
    lower.includes('tap') || 
    lower.includes('sink') || 
    lower.includes('basin') || 
    lower.includes('bathroom') || 
    lower.includes('tank') || 
    lower.includes('drain') || 
    lower.includes('plumb') ||
    text.includes('পাইপ') ||
    text.includes('লিক') ||
    text.includes('কল') ||
    text.includes('বাথরুম') ||
    text.includes('ট্যাংক')
  ) {
    trade = 'plumbing';
  } else if (
    lower.includes('ac') || 
    lower.includes('air conditioner') || 
    lower.includes('fridge') || 
    lower.includes('refrigerator') || 
    lower.includes('washing machine') || 
    lower.includes('microwave') || 
    lower.includes('geyser') || 
    lower.includes('appliance') || 
    lower.includes('voltas') ||
    text.includes('এসি') ||
    text.includes('ফ্রিজ') ||
    text.includes('গিজার') ||
    text.includes('মেশিন')
  ) {
    trade = 'appliance';
  }

  // 2. Extract Customer Names with common patterns
  // Pattern: "for [Name]", "repaired [Name]'s", "fixed [Name]'s", "[Name] babu", "[Name] ji"
  const forMatch = text.match(/(?:for|of|to|কাছে|জন্য)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const possessiveMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:'s|’s)/i);
  const honorificMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:babu|ji|da|roy|sen|ghosh|sharma|mukherjee|das|singh)/i);
  const bengaliNameMatch = text.match(/(সুমন|রমেশ|অমিত|প্রিয়া|অনন্যা|রাজেশ|দেবাশীষ)(?:\s+(?:ঘোষ|বাবু|সেন|রায়|মুখার্জী|শর্মা|মিত্র))?/);

  if (forMatch && forMatch[1]) {
    customerName = forMatch[1].trim();
  } else if (possessiveMatch && possessiveMatch[1]) {
    customerName = possessiveMatch[1].trim();
  } else if (honorificMatch && honorificMatch[0]) {
    customerName = honorificMatch[0].trim();
  } else if (bengaliNameMatch && bengaliNameMatch[0]) {
    customerName = bengaliNameMatch[0].trim();
  }

  // 3. Extract Monetary figures (Agreed amount and Amount paid)
  // Handles ₹1200, ₹ 1,200, 1200 rupees, 1200 taka, 1200 rs
  // Look for currency indicators
  const numbersWithCurrency = [...text.matchAll(/(?:₹|rs\.?|inr|টাকা)\s*([0-9,]+)|([0-9,]+)\s*(?:₹|rupees?|rs\.?|টাকা)/gi)];
  const extractedNumbers: number[] = [];

  for (const m of numbersWithCurrency) {
    const rawNum = m[1] || m[2];
    if (rawNum) {
      const parsed = parseInt(rawNum.replace(/,/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) {
        extractedNumbers.push(parsed);
      }
    }
  }

  // If regular rupee pattern didn't catch, fallback to raw numbers in text
  if (extractedNumbers.length === 0) {
    const rawDigits = text.match(/\b\d{3,5}\b/g);
    if (rawDigits) {
      rawDigits.forEach((d) => {
        const num = parseInt(d, 10);
        if (num >= 50 && num <= 100000) {
          extractedNumbers.push(num);
        }
      });
    }
  }

  // Check for keywords like "full paid", "fully paid", "পুরোটাই", "all paid"
  const isFullPaid = 
    lower.includes('full paid') || 
    lower.includes('fully paid') || 
    lower.includes('paid full') || 
    lower.includes('paid in full') ||
    text.includes('পুরোটাই') ||
    text.includes('সম্পূর্ণ');

  const isPending = 
    lower.includes('pending') || 
    lower.includes('unpaid') || 
    lower.includes('zero paid') ||
    text.includes('বাকি');

  if (extractedNumbers.length >= 2) {
    // Usually the larger number is agreed, the smaller is paid (or first is agreed, second is paid)
    if (extractedNumbers[0] >= extractedNumbers[1]) {
      agreedAmount = extractedNumbers[0];
      amountPaid = extractedNumbers[1];
    } else {
      agreedAmount = extractedNumbers[1];
      amountPaid = extractedNumbers[0];
    }
  } else if (extractedNumbers.length === 1) {
    agreedAmount = extractedNumbers[0];
    if (isFullPaid) {
      amountPaid = agreedAmount;
    } else if (isPending) {
      amountPaid = 0;
    } else if (lower.includes('paid') || text.includes('জমা')) {
      amountPaid = agreedAmount;
    } else {
      amountPaid = 0;
    }
  } else {
    agreedAmount = 800; // sensible fallback
    amountPaid = 0;
  }

  // Deterministic remaining balance calculation
  const remainingBalance = Math.max(0, agreedAmount - amountPaid);

  // Clean description
  description = text
    .replace(/^["'“”]|["'“”]$/g, '')
    .trim();

  // If text is short, enrich with trade context
  if (description.length < 10) {
    description = `${trade.charAt(0).toUpperCase() + trade.slice(1)} service for ${customerName}`;
  }

  return {
    customerName,
    customerPhone,
    trade,
    description,
    agreedAmount,
    amountPaid,
    remainingBalance,
    notes,
  };
};
