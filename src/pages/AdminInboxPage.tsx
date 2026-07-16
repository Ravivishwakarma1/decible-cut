import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminInboxPage.module.css';
import { supportDbService } from '../services/supportDbService';
import type { SupportTicket, SupportMessage } from '../services/supportDbService';
import { useSEO } from '../hooks/useSEO';
import {
  Mail, Star, CheckCircle, Trash2, Send, CornerDownLeft, FolderOpen,
  Settings, Search, ArrowLeft, RefreshCw, LogOut, Check,
  AlertCircle, AlertTriangle, Info
} from 'lucide-react';

const safeGetIsoDate = (dateVal: string | null | undefined): string => {
  if (!dateVal) return new Date().toISOString();
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
};

const CANNED_RESPONSES = [
  {
    name: 'Select a template...',
    value: ''
  },
  {
    name: '1. Brave Browser FFmpeg Issue',
    value: `Hi! Thanks for reaching out.

In Brave Browser, WebAssembly and SharedArrayBuffers (which FFmpeg.wasm relies on for client-side processing) are sometimes restricted by Brave's default shielding settings.

To resolve this:
1. Try turning off "Brave Shields" for DecibelCut (click the lion icon in the URL bar and toggle it off).
2. Go to Brave Settings > Privacy and Security > Sites that can use WebAssembly, and ensure decibelcut.com is allowed.
3. Reload the tab and try again.

Let me know if this gets it working for you!`
  },
  {
    name: '2. Spotify Loudness Preset',
    value: `Hi! Thank you for the suggestion.

Our loudness presets target standard streaming outputs using a client-side DSP gain normalize chain and peak limiters. 

We currently target -14 LUFS (Spotify Standard) with a -1.0 dBTP ceiling to avoid clipping. We will add a "-11 LUFS (Spotify Loud / Speech-Optimized)" preset in our next update (v1.1) to support speech creators who need louder outputs. Under the hood, this uses our custom Web Audio Compressor and Peak Limiter filter nodes.

Thank you for your feedback, it helps us improve DecibelCut!`
  },
  {
    name: '3. Browser Tab Crash (Large Files)',
    value: `Hello! 

Because DecibelCut is a local-first application, all audio/video decoding and editing happens completely in your browser's RAM without any server uploads. 

Browsers generally restrict individual tabs to a maximum of 2GB to 4GB of RAM. When processing large files (above 500MB) or executing batch runs concurrently, memory limits can exceed this threshold, leading to a crash.

To prevent this:
1. Please process large video files one at a time.
2. Close other resource-heavy browser tabs to free up system memory.
3. Ensure your computer has at least 8GB of system RAM.

We are implementing a warnings guide for large files to alert users before processing. Let us know if you need anything else!`
  },
  {
    name: '4. General Greeting',
    value: `Hi! 

Thank you for contacting DecibelCut support. 

I've reviewed your request and would be happy to help. Can you please confirm which version of DecibelCut you are running (found in the settings footer) and if you see any red error logs in your browser developer console (Ctrl+Shift+I or Cmd+Option+I)?

Looking forward to your reply,
DecibelCut Support Team`
  }
];

export const AdminInboxPage: React.FC = () => {
  useSEO({
    title: 'Admin Support Inbox | DecibelCut',
    description: 'Manage and reply to DecibelCut customer support tickets via Gmail or Outlook.'
  });

  const navigate = useNavigate();
  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Connection settings
  const [provider, setProvider] = useState<'local' | 'gmail' | 'outlook'>('local');
  const [gmailClientId, setGmailClientId] = useState('');
  const [gmailSearchQuery, setGmailSearchQuery] = useState('subject:"DecibelCut Support"');
  const [outlookClientId, setOutlookClientId] = useState('');
  const [outlookSearchQuery, setOutlookSearchQuery] = useState('DecibelCut Support');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');

  // Token states
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [outlookToken, setOutlookToken] = useState<string | null>(null);

  // Tickets data
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  // UI filter and search states
  const [activeFolder, setActiveFolder] = useState<'all' | 'new' | 'opened' | 'starred' | 'resolved'>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Composition / Reply states
  const [replyText, setReplyText] = useState('');
  const [cannedResponse, setCannedResponse] = useState('');
  const [includeSignature, setIncludeSignature] = useState(true);

  // UI state indicators
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Parse OAuth redirects on mount
  useEffect(() => {
    const isAdminAuth = localStorage.getItem('decibelcut_admin_auth') === 'true';
    if (!isAdminAuth) {
      navigate('/admin');
      return;
    }

    const hash = window.location.hash;
    if (hash) {
      const parsed: Record<string, string> = {};
      hash.substring(1).split('&').forEach(item => {
        const parts = item.split('=');
        if (parts.length === 2) {
          parsed[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
        }
      });

      const token = parsed.access_token;
      // Microsoft uses state parameter, Google also does
      const state = parsed.state; 

      if (token) {
        if (state === 'gmail') {
          localStorage.setItem('decibelcut_gmail_token', token);
          setGmailToken(token);
          setProvider('gmail');
          showToast('success', 'Connected to Gmail successfully!');
        } else if (state === 'outlook') {
          localStorage.setItem('decibelcut_outlook_token', token);
          setOutlookToken(token);
          setProvider('outlook');
          showToast('success', 'Connected to Outlook successfully!');
        }
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // Load credentials and tokens from localStorage
    setGmailClientId(localStorage.getItem('decibelcut_gmail_client_id') || '');
    setGmailSearchQuery(localStorage.getItem('decibelcut_gmail_search_query') || 'subject:"DecibelCut Support"');
    setOutlookClientId(localStorage.getItem('decibelcut_outlook_client_id') || '');
    setOutlookSearchQuery(localStorage.getItem('decibelcut_outlook_search_query') || 'DecibelCut Support');
    
    setGmailToken(localStorage.getItem('decibelcut_gmail_token'));
    setOutlookToken(localStorage.getItem('decibelcut_outlook_token'));
    setGroqApiKey(localStorage.getItem('decibelcut_groq_api_key') || '');
    setGroqModel(localStorage.getItem('decibelcut_groq_model') || 'llama-3.3-70b-versatile');
    
    const savedProvider = localStorage.getItem('decibelcut_provider') as any;
    if (savedProvider && ['local', 'gmail', 'outlook'].includes(savedProvider)) {
      setProvider(savedProvider);
    }
  }, []);

  // Fetch tickets based on selected provider and settings
  useEffect(() => {
    localStorage.setItem('decibelcut_provider', provider);
    loadTickets();
  }, [provider, gmailToken, outlookToken]);

  // Auto-reload when tab becomes active or localStorage changes in another tab
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'decibelcut_support_tickets') {
        loadTickets();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadTickets();
      }
    };
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [provider]);

  // Scroll to bottom of chat history when selection changes
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTicketId, tickets]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTickets = async () => {
    setLoading(true);

    if (provider === 'local') {
      const localTickets = supportDbService.getAllTickets();
      setTickets(localTickets);
      setLoading(false);
      return;
    }

    // Real Gmail fetch
    if (provider === 'gmail') {
      if (!gmailToken) {
        setTickets(getGmailMockTickets());
        setLoading(false);
        return;
      }
      try {
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailSearchQuery)}`,
          { headers: { Authorization: `Bearer ${gmailToken}` } }
        );

        if (!listRes.ok) {
          if (listRes.status === 401) handleAuthError('gmail');
          throw new Error('Gmail API request failed');
        }

        const listData = await listRes.json();
        const messages = listData.messages || [];

        if (messages.length === 0) {
          setTickets([]);
          setLoading(false);
          return;
        }

        // Fetch top 10 message details concurrently
        const detailsPromises = messages.slice(0, 10).map(async (msg: any) => {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${gmailToken}` } }
          );
          return detailRes.json();
        });

        const details = await Promise.all(detailsPromises);
        const mappedTickets = mapGmailMessagesToTickets(details);
        setTickets(mappedTickets);
      } catch (err) {
        console.error('Failed to load Gmail messages, loading mock fallback:', err);
        showToast('error', 'Failed to sync Gmail inbox. Loading simulated mailbox.');
        setTickets(getGmailMockTickets());
      }
      setLoading(false);
    }

    // Real Outlook fetch
    if (provider === 'outlook') {
      if (!outlookToken) {
        setTickets(getOutlookMockTickets());
        setLoading(false);
        return;
      }
      try {
        const query = `$search="${outlookSearchQuery}"&$orderby=receivedDateTime desc`;
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages?${query}`,
          { headers: { Authorization: `Bearer ${outlookToken}` } }
        );

        if (!res.ok) {
          if (res.status === 401) handleAuthError('outlook');
          throw new Error('Outlook Graph API request failed');
        }

        const data = await res.json();
        const mappedTickets = mapOutlookMessagesToTickets(data.value || []);
        setTickets(mappedTickets);
      } catch (err) {
        console.error('Failed to load Outlook messages, loading mock fallback:', err);
        showToast('error', 'Failed to sync Outlook inbox. Loading simulated mailbox.');
        setTickets(getOutlookMockTickets());
      }
      setLoading(false);
    }
  };

  const handleAuthError = (type: 'gmail' | 'outlook') => {
    if (type === 'gmail') {
      localStorage.removeItem('decibelcut_gmail_token');
      setGmailToken(null);
    } else {
      localStorage.removeItem('decibelcut_outlook_token');
      setOutlookToken(null);
    }
    showToast('error', `Session expired. Please reconnect your ${type === 'gmail' ? 'Gmail' : 'Outlook'} account.`);
  };

  // Gmail Mapper
  const mapGmailMessagesToTickets = (gmailMsgs: any[]): SupportTicket[] => {
    const threadsMap: Record<string, SupportTicket> = {};

    gmailMsgs.forEach(msg => {
      const threadId = msg.threadId;
      const headers = msg.payload.headers;
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('subject');
      const fromHeader = getHeader('from'); // Format: "Name <email@site.com>"
      const date = getHeader('date');

      let senderName = 'Unknown User';
      let senderEmail = 'unknown@example.com';
      const fromMatch = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
      if (fromMatch) {
        senderName = fromMatch[1].replace(/['"]/g, '').trim();
        senderEmail = fromMatch[2].trim();
      } else if (fromHeader) {
        senderName = fromHeader;
        senderEmail = fromHeader;
      }

      // Decode Base64url body data safely
      const getBodyContent = (payload: any): string => {
        if (payload.body && payload.body.data) {
          try {
            const base64 = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
            return decodeURIComponent(
              atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
          } catch (e) {
            return 'Could not decode email body.';
          }
        }
        if (payload.parts) {
          for (const part of payload.parts) {
            const body = getBodyContent(part);
            if (body) return body;
          }
        }
        return '';
      };

      const bodyText = getBodyContent(msg.payload);

      const supportMsg: SupportMessage = {
        id: msg.id,
        sender: senderEmail.includes('support@') || senderEmail.includes('deciblecut') ? 'admin' : 'user',
        senderName,
        senderEmail,
        body: bodyText || msg.snippet || '',
        timestamp: safeGetIsoDate(date),
        source: 'gmail'
      };

      if (!threadsMap[threadId]) {
        // Classify Category & Priority
        let category: any = 'General';
        const cleanSub = subject.toLowerCase();
        if (cleanSub.includes('bug') || cleanSub.includes('error') || cleanSub.includes('crash')) category = 'Bug';
        else if (cleanSub.includes('preset') || cleanSub.includes('lufs')) category = 'Preset Request';
        else if (cleanSub.includes('feature') || cleanSub.includes('request')) category = 'Feature Request';

        let priority: 'Low' | 'Medium' | 'High' = 'Low';
        if (category === 'Bug') priority = 'High';
        else if (category === 'Preset Request' || category === 'Feature Request') priority = 'Medium';

        threadsMap[threadId] = {
          id: threadId,
          name: senderName,
          email: senderEmail,
          subject: subject,
          category,
          status: 'Open',
          priority,
          starred: msg.labelIds?.includes('STARRED') || false,
          unread: msg.labelIds?.includes('UNREAD') || false,
          createdAt: safeGetIsoDate(date),
          updatedAt: safeGetIsoDate(date),
          source: 'gmail',
          messages: []
        };
      }

      threadsMap[threadId].messages.push(supportMsg);
    });

    const savedStatuses: Record<string, 'Open' | 'Pending' | 'Resolved'> = JSON.parse(
      localStorage.getItem('decibelcut_api_ticket_statuses') || '{}'
    );

    // Sort messages inside threads chronologically, and threads by updatedAt descending
    return Object.values(threadsMap).map(ticket => {
      ticket.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      const lastMsg = ticket.messages[ticket.messages.length - 1];
      ticket.updatedAt = lastMsg.timestamp;
      
      if (savedStatuses[ticket.id]) {
        ticket.status = savedStatuses[ticket.id];
      } else {
        // If last message is from admin, set status pending
        if (lastMsg.sender === 'admin') {
          ticket.status = 'Pending';
        } else {
          ticket.status = 'Open';
        }
      }
      return ticket;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  };

  // Outlook Mapper
  const mapOutlookMessagesToTickets = (outlookMsgs: any[]): SupportTicket[] => {
    const threadsMap: Record<string, SupportTicket> = {};

    outlookMsgs.forEach(msg => {
      const convId = msg.conversationId || msg.id;
      const senderName = msg.from?.emailAddress?.name || 'Unknown User';
      const senderEmail = msg.from?.emailAddress?.address || 'unknown@example.com';
      const bodyText = msg.body?.content || msg.bodyPreview || '';

      const supportMsg: SupportMessage = {
        id: msg.id,
        sender: senderEmail.includes('support@') || senderEmail.includes('deciblecut') ? 'admin' : 'user',
        senderName,
        senderEmail,
        body: bodyText.replace(/<[^>]*>?/gm, ''), // Strip HTML tags
        timestamp: safeGetIsoDate(msg.receivedDateTime),
        source: 'outlook'
      };

      if (!threadsMap[convId]) {
        let category: any = 'General';
        const cleanSub = (msg.subject || '').toLowerCase();
        if (cleanSub.includes('bug') || cleanSub.includes('error') || cleanSub.includes('crash')) category = 'Bug';
        else if (cleanSub.includes('preset') || cleanSub.includes('lufs')) category = 'Preset Request';
        else if (cleanSub.includes('feature')) category = 'Feature Request';

        let priority: 'Low' | 'Medium' | 'High' = 'Low';
        if (category === 'Bug') priority = 'High';
        else if (category === 'Preset Request' || category === 'Feature Request') priority = 'Medium';

        threadsMap[convId] = {
          id: convId,
          name: senderName,
          email: senderEmail,
          subject: msg.subject || 'No Subject',
          category,
          status: 'Open',
          priority,
          starred: msg.importance === 'high',
          unread: !msg.isRead,
          createdAt: safeGetIsoDate(msg.receivedDateTime),
          updatedAt: safeGetIsoDate(msg.receivedDateTime),
          source: 'outlook',
          messages: []
        };
      }

      threadsMap[convId].messages.push(supportMsg);
    });

    const savedStatuses: Record<string, 'Open' | 'Pending' | 'Resolved'> = JSON.parse(
      localStorage.getItem('decibelcut_api_ticket_statuses') || '{}'
    );

    return Object.values(threadsMap).map(ticket => {
      ticket.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const lastMsg = ticket.messages[ticket.messages.length - 1];
      ticket.updatedAt = lastMsg.timestamp;
      
      if (savedStatuses[ticket.id]) {
        ticket.status = savedStatuses[ticket.id];
      } else {
        if (lastMsg.sender === 'admin') {
          ticket.status = 'Pending';
        } else {
          ticket.status = 'Open';
        }
      }
      return ticket;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  };

  // Mock data fallback generators
  const getGmailMockTickets = (): SupportTicket[] => {
    return [];
  };

  const getOutlookMockTickets = (): SupportTicket[] => {
    return [];
  };

  // OAuth triggers
  const handleConnectGmail = () => {
    if (!gmailClientId) {
      showToast('error', 'Please configure your Google OAuth Client ID first.');
      setShowSettings(true);
      return;
    }
    const redirectUri = `${window.location.origin}/admin/inbox`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${gmailClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify')}&state=gmail`;
    window.location.href = googleAuthUrl;
  };

  const handleConnectOutlook = () => {
    if (!outlookClientId) {
      showToast('error', 'Please configure your Microsoft OAuth Client ID first.');
      setShowSettings(true);
      return;
    }
    const redirectUri = `${window.location.origin}/admin/inbox`;
    const msAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${outlookClientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read')}&response_mode=fragment&state=outlook`;
    window.location.href = msAuthUrl;
  };

  const handleDisconnect = () => {
    if (provider === 'gmail') {
      localStorage.removeItem('decibelcut_gmail_token');
      setGmailToken(null);
      showToast('success', 'Logged out of Gmail account.');
    } else if (provider === 'outlook') {
      localStorage.removeItem('decibelcut_outlook_token');
      setOutlookToken(null);
      showToast('success', 'Logged out of Outlook account.');
    }
    setProvider('local');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('decibelcut_admin_auth');
    navigate('/admin');
  };

  const handleResetLocalStorage = () => {
    localStorage.removeItem('decibelcut_support_tickets');
    localStorage.removeItem('decibelcut_api_ticket_statuses');
    loadTickets();
    showToast('success', 'Local database and status cache cleared.');
  };

  const handleSaveSettings = () => {
    localStorage.setItem('decibelcut_gmail_client_id', gmailClientId);
    localStorage.setItem('decibelcut_gmail_search_query', gmailSearchQuery);
    localStorage.setItem('decibelcut_outlook_client_id', outlookClientId);
    localStorage.setItem('decibelcut_outlook_search_query', outlookSearchQuery);
    localStorage.setItem('decibelcut_groq_api_key', groqApiKey);
    localStorage.setItem('decibelcut_groq_model', groqModel);
    
    setShowSettings(false);
    showToast('success', 'Connection settings saved.');
    loadTickets();
  };

  const handleDraftWithGroq = async () => {
    const ticket = selectedTicket;
    if (!ticket || !groqApiKey) return;
    setIsGeneratingReply(true);

    try {
      const historyText = ticket.messages
        .map(m => `${m.sender === 'admin' ? 'Support Agent (Us)' : m.senderName} (${m.timestamp}): ${m.body}`)
        .join('\n\n');

      const systemPrompt = `You are a professional, helpful, and concise customer support representative for DecibelCut (a privacy-first web application for audio editing, silence removal, and podcast creator tools).
Write a direct response to the customer's query. Maintain a friendly, supportive tone. Address them by their name if available.
You MUST explicitly reference the Ticket ID (which is ${ticket.id}) somewhere in your reply text (for example, "Regarding your support ticket ${ticket.id}..." or "(Ref ID: ${ticket.id})").
Keep the response under 150 words. Do not use generic signatures (the app will append a signature automatically).

FORMATTING INSTRUCTIONS:
- Use clean formatting with clear paragraphs and double line breaks between sections.
- Avoid writing a single dense wall of text.
- Use bullet points or numbered lists if explaining multiple features, steps, or items.
- Format the response as a well-structured, professional email (e.g. short 2-3 sentence paragraphs).`;

      const response = await fetch(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: groqModel || 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: `Here is the conversation history:\n${historyText}`
              }
            ],
            temperature: 0.7
          })
        }
      );

      if (!response.ok) {
        let errorMsg = `HTTP error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error?.message) {
            errorMsg = errData.error.message;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content;
      
      if (generatedText) {
        setReplyText(generatedText.trim());
        showToast('success', 'Groq drafted a reply for you!');
      } else {
        throw new Error('No content returned from Groq.');
      }
    } catch (e: any) {
      console.error(e);
      showToast('error', `Failed to generate AI reply: ${e.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // Reply Sender
  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;

    const ticket = tickets.find(t => t.id === selectedTicketId);
    if (!ticket) return;

    setIsSending(true);
    const ticketRefStr = `\n\n[Ticket ID: ${ticket.id}]`;
    const signature = includeSignature 
      ? `\n\nBest regards,\nDecibelCut Support Team${ticketRefStr}` 
      : ticketRefStr;
    const fullReply = replyText.trim() + signature;

    // LOCAL DB REPLY
    if (ticket.source === 'local') {
      const trySendRealLocalEmail = async () => {
        // If Gmail token is active, send a real email via Gmail API
        if (gmailToken) {
          try {
            const base64urlEncode = (str: string) => {
              return btoa(unescape(encodeURIComponent(str)))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            };

            const rawEmail = [
              `To: ${ticket.email}`,
              `Subject: ${ticket.subject.startsWith('Re:') ? ticket.subject : 'Re: ' + ticket.subject}`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 7bit`,
              '',
              fullReply
            ].join('\r\n');

            const sendRes = await fetch(
              'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${gmailToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  raw: base64urlEncode(rawEmail)
                })
              }
            );

            if (!sendRes.ok) {
              throw new Error('Gmail Send failed');
            }
            return 'Gmail';
          } catch (err) {
            console.error('Failed to send real email via Gmail for local ticket:', err);
            return null;
          }
        }

        // If Outlook token is active, send a real email via Outlook Graph API
        if (outlookToken) {
          try {
            const sendRes = await fetch(
              'https://graph.microsoft.com/v1.0/me/sendMail',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${outlookToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  message: {
                    subject: ticket.subject.startsWith('Re:') ? ticket.subject : 'Re: ' + ticket.subject,
                    body: {
                      contentType: 'Text',
                      content: fullReply
                    },
                    toRecipients: [
                      {
                        emailAddress: {
                          address: ticket.email
                        }
                      }
                    ]
                  }
                })
              }
            );

            if (!sendRes.ok) {
              throw new Error('Outlook Send failed');
            }
            return 'Outlook';
          } catch (err) {
            console.error('Failed to send real email via Outlook for local ticket:', err);
            return null;
          }
        }

        return null;
      };

      const executeLocalReply = async () => {
        const sentVia = await trySendRealLocalEmail();
        const updated = supportDbService.addReply(ticket.id, fullReply);
        
        if (updated) {
          loadTickets();
          setReplyText('');
          setCannedResponse('');
          if (sentVia) {
            showToast('success', `Reply saved locally & sent to customer via ${sentVia}!`);
          } else {
            showToast('success', 'Reply saved locally (Simulation Mode - No active API connection).');
          }
        } else {
          showToast('error', 'Failed to save local reply.');
        }
        setIsSending(false);
      };

      executeLocalReply();
      return;
    }

    // GMAIL API REPLY
    if (ticket.source === 'gmail') {
      if (!gmailToken) {
        // Simulated Gmail reply
        setTimeout(() => {
          simulateProviderReply(ticket, fullReply);
          showToast('success', 'Simulated Gmail reply sent successfully!');
          setIsSending(false);
        }, 1200);
        return;
      }

      try {
        const lastMsg = ticket.messages[ticket.messages.length - 1];
        
        // Base64url encoder
        const base64urlEncode = (str: string) => {
          return btoa(unescape(encodeURIComponent(str)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        };

        const rawEmail = [
          `To: ${ticket.email}`,
          `Subject: ${ticket.subject.startsWith('Re:') ? ticket.subject : 'Re: ' + ticket.subject}`,
          `In-Reply-To: ${lastMsg.id}`,
          `References: ${lastMsg.id}`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Transfer-Encoding: 7bit`,
          '',
          fullReply
        ].join('\r\n');

        const sendRes = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${gmailToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              raw: base64urlEncode(rawEmail),
              threadId: ticket.id
            })
          }
        );

        if (!sendRes.ok) {
          throw new Error('Gmail Send failed');
        }

        // Add locally so they don't wait for sync
        appendLocalReplyState(ticket.id, fullReply, 'gmail');
        setReplyText('');
        setCannedResponse('');
        showToast('success', 'Reply sent via Gmail!');
      } catch (err) {
        console.error(err);
        showToast('error', 'Failed to send reply via Gmail API.');
      }
      setIsSending(false);
      return;
    }

    // OUTLOOK API REPLY
    if (ticket.source === 'outlook') {
      if (!outlookToken) {
        // Simulated Outlook reply
        setTimeout(() => {
          simulateProviderReply(ticket, fullReply);
          showToast('success', 'Simulated Outlook reply sent successfully!');
          setIsSending(false);
        }, 1200);
        return;
      }

      try {
        const lastMsg = ticket.messages[ticket.messages.length - 1];
        const replyRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${lastMsg.id}/reply`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${outlookToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              comment: fullReply
            })
          }
        );

        if (!replyRes.ok) {
          throw new Error('Outlook Reply failed');
        }

        // Add locally for instant feed
        appendLocalReplyState(ticket.id, fullReply, 'outlook');
        setReplyText('');
        setCannedResponse('');
        showToast('success', 'Reply sent via Outlook!');
      } catch (err) {
        console.error(err);
        showToast('error', 'Failed to send reply via Microsoft Graph API.');
      }
      setIsSending(false);
      return;
    }
  };

  const simulateProviderReply = (ticket: SupportTicket, replyContent: string) => {
    const updatedTickets = tickets.map(t => {
      if (t.id === ticket.id) {
        const newMsg: SupportMessage = {
          id: `sim-m-${Date.now()}`,
          sender: 'admin',
          senderName: 'DecibelCut Admin',
          senderEmail: 'support@deciblecut.com',
          body: replyContent,
          timestamp: new Date().toISOString(),
          source: ticket.source
        };
        return {
          ...t,
          status: 'Pending' as const,
          unread: false,
          updatedAt: new Date().toISOString(),
          messages: [...t.messages, newMsg]
        };
      }
      return t;
    });
    setTickets(updatedTickets);
    setReplyText('');
    setCannedResponse('');
  };

  const appendLocalReplyState = (ticketId: string, replyContent: string, src: 'gmail' | 'outlook') => {
    const newMsg: SupportMessage = {
      id: `m-rep-${Date.now()}`,
      sender: 'admin',
      senderName: 'DecibelCut Admin',
      senderEmail: 'support@deciblecut.com',
      body: replyContent,
      timestamp: new Date().toISOString(),
      source: src
    };

    const savedStatuses = JSON.parse(localStorage.getItem('decibelcut_api_ticket_statuses') || '{}');
    savedStatuses[ticketId] = 'Pending';
    localStorage.setItem('decibelcut_api_ticket_statuses', JSON.stringify(savedStatuses));

    setTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          status: 'Pending',
          unread: false,
          updatedAt: new Date().toISOString(),
          messages: [...t.messages, newMsg]
        };
      }
      return t;
    }));
  };

  // Ticket actions
  const handleToggleStarred = (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (provider === 'local') {
      supportDbService.toggleStarred(ticketId);
      loadTickets();
    } else {
      // client-side memory update for mock modes
      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) {
          return { ...t, starred: !t.starred };
        }
        return t;
      }));
    }
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (provider === 'local') {
      supportDbService.deleteTicket(ticketId);
      setSelectedTicketId(null);
      loadTickets();
      showToast('success', 'Ticket deleted from local database.');
    } else {
      // simulated deletion
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      setSelectedTicketId(null);
      showToast('success', 'Simulated ticket removed.');
    }
  };

  const handleStatusChange = (ticketId: string, newStatus: 'Open' | 'Pending' | 'Resolved') => {
    if (provider === 'local') {
      supportDbService.updateTicketStatus(ticketId, newStatus);
      loadTickets();
    } else {
      const savedStatuses = JSON.parse(localStorage.getItem('decibelcut_api_ticket_statuses') || '{}');
      savedStatuses[ticketId] = newStatus;
      localStorage.setItem('decibelcut_api_ticket_statuses', JSON.stringify(savedStatuses));

      setTickets(prev => prev.map(t => {
        if (t.id === ticketId) {
          return { ...t, status: newStatus };
        }
        return t;
      }));
    }
  };

  const handleSelectCanned = (val: string) => {
    setCannedResponse(val);
    setReplyText(val);
  };

  // Filtering
  const filteredTickets = tickets
    .filter(t => {
      // Folder filtering
      if (activeFolder === 'new') return t.unread;
      if (activeFolder === 'opened') return t.status === 'Open' || t.status === 'Pending';
      if (activeFolder === 'resolved') return t.status === 'Resolved';
      if (activeFolder === 'starred') return t.starred;
      return true;
    })
    .filter(t => {
      // Category filtering
      if (selectedCategory === 'all') return true;
      return t.category.toLowerCase() === selectedCategory.toLowerCase();
    })
    .filter(t => {
      // Text search
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.messages.some(m => m.body.toLowerCase().includes(q))
      );
    });

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  // Tab/Folder counts
  const newCount = tickets.filter(t => t.unread).length;
  const openedCount = tickets.filter(t => t.status === 'Open' || t.status === 'Pending').length;
  const starredCount = tickets.filter(t => t.starred).length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  const isProviderConnected = provider === 'local' || (provider === 'gmail' && gmailToken) || (provider === 'outlook' && outlookToken);

  // Generate a seed gradient background based on user name
  const getAvatarGradient = (name: string) => {
    const colors = [
      ['#ec4899', '#f43f5e'], // Pink -> Red
      ['#f97316', '#fbbf24'], // Orange -> Yellow
      ['#10b981', '#059669'], // Green
      ['#3b82f6', '#1d4ed8'], // Blue
      ['#8b5cf6', '#6d28d9'], // Violet
      ['#06b6d4', '#0891b2'], // Cyan
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    const grad = colors[sum % colors.length];
    return `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`;
  };

  return (
    <div className={styles.root}>
      {/* PANE 1: Sidebar account and folder list */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logoIcon}><CornerDownLeft size={20} /></span>
          <span className={styles.sidebarTitle}>Support Center</span>
        </div>

        {/* Channels */}
        <div className={styles.sidebarSection}>
          <h3 className={styles.sectionTitle}>Account Source</h3>
          <div className={styles.providerList}>
            <button
              className={[styles.providerBtn, provider === 'local' ? styles.providerBtnActive : ''].join(' ')}
              onClick={() => setProvider('local')}
            >
              <span className={styles.providerLabel}>
                <span className={[styles.statusDot, styles.statusDotConnected].join(' ')} />
                Local Database
              </span>
            </button>

            <button
              className={[styles.providerBtn, provider === 'gmail' ? styles.providerBtnActive : ''].join(' ')}
              onClick={() => setProvider('gmail')}
            >
              <span className={styles.providerLabel}>
                <span className={[
                  styles.statusDot,
                  gmailToken ? styles.statusDotConnected : styles.statusDotPending
                ].join(' ')} />
                Gmail Account
              </span>
              {!gmailToken && <span style={{ fontSize: '0.7rem' }}>OAuth</span>}
            </button>

            <button
              className={[styles.providerBtn, provider === 'outlook' ? styles.providerBtnActive : ''].join(' ')}
              onClick={() => setProvider('outlook')}
            >
              <span className={styles.providerLabel}>
                <span className={[
                  styles.statusDot,
                  outlookToken ? styles.statusDotConnected : styles.statusDotPending
                ].join(' ')} />
                Outlook Account
              </span>
              {!outlookToken && <span style={{ fontSize: '0.7rem' }}>OAuth</span>}
            </button>
          </div>
        </div>

        {/* Folders */}
        <div className={styles.sidebarSection} style={{ flex: 1 }}>
          <h3 className={styles.sectionTitle}>Inbox Folders</h3>
          <div className={styles.folderList}>
            <button
              className={[styles.folderBtn, activeFolder === 'new' ? styles.folderBtnActive : ''].join(' ')}
              onClick={() => setActiveFolder('new')}
            >
              <span className={styles.folderLabel}><Mail size={16} style={{ color: 'var(--color-accent-light)' }} /> New Tickets</span>
              {newCount > 0 && <span className={styles.folderCount} style={{ backgroundColor: 'var(--color-accent-alpha)', color: 'var(--color-accent-light)' }}>{newCount}</span>}
            </button>

            <button
              className={[styles.folderBtn, activeFolder === 'opened' ? styles.folderBtnActive : ''].join(' ')}
              onClick={() => setActiveFolder('opened')}
            >
              <span className={styles.folderLabel}><FolderOpen size={16} style={{ color: 'var(--color-info)' }} /> Opened</span>
              <span className={styles.folderCount}>{openedCount}</span>
            </button>

            <button
              className={[styles.folderBtn, activeFolder === 'resolved' ? styles.folderBtnActive : ''].join(' ')}
              onClick={() => setActiveFolder('resolved')}
            >
              <span className={styles.folderLabel}><CheckCircle size={16} style={{ color: 'var(--color-success)' }} /> Resolved</span>
              <span className={styles.folderCount}>{resolvedCount}</span>
            </button>

            <button
              className={[styles.folderBtn, activeFolder === 'starred' ? styles.folderBtnActive : ''].join(' ')}
              onClick={() => setActiveFolder('starred')}
            >
              <span className={styles.folderLabel}><Star size={16} style={{ color: 'var(--color-warning)' }} /> Starred</span>
              <span className={styles.folderCount}>{starredCount}</span>
            </button>

            <button
              className={[styles.folderBtn, activeFolder === 'all' ? styles.folderBtnActive : ''].join(' ')}
              onClick={() => setActiveFolder('all')}
            >
              <span className={styles.folderLabel}><Mail size={16} /> All Support</span>
              <span className={styles.folderCount}>{tickets.length}</span>
            </button>
          </div>
        </div>

        {/* Diagnostics Panel (Collapsible) */}
        <div className={styles.sidebarSection} style={{ borderTop: '1px solid var(--color-border)', flexGrow: 0 }}>
          <h3 className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showDiagnostics ? '0.5rem' : 0 }}>
            <span>Diagnostics</span>
            <button 
              onClick={() => setShowDiagnostics(!showDiagnostics)} 
              style={{ background: 'none', border: 'none', color: 'var(--color-accent-light)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
            >
              {showDiagnostics ? 'Hide' : 'Show'}
            </button>
          </h3>
          {showDiagnostics && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-primary)', padding: '0.625rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>Local count: <strong>{tickets.filter(t => t.source === 'local').length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>Total count: <strong>{tickets.length}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>Gmail Auth: <strong>{gmailToken ? '🟢 Connected' : '🔴 Disconnected'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>Outlook Auth: <strong>{outlookToken ? '🟢 Connected' : '🔴 Disconnected'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>Active Source: <strong>{provider.toUpperCase()}</strong></div>
              <button 
                onClick={handleResetLocalStorage}
                style={{ marginTop: '0.4rem', padding: '0.35rem', fontSize: '0.72rem', color: 'var(--color-error)', background: 'rgba(248,113,113,0.05)', border: '1px solid var(--color-error-alpha)', borderRadius: 'var(--radius-xs)', cursor: 'pointer', fontWeight: 600, width: '100%', textAlign: 'center' }}
              >
                Reset Local Storage
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className={styles.sidebarFooter}>
          {isProviderConnected && provider !== 'local' && (
            <button className={styles.configBtn} onClick={handleDisconnect}>
              <LogOut size={14} /> Disconnect API
            </button>
          )}

          <button className={styles.configBtn} onClick={() => setShowSettings(true)}>
            <Settings size={14} /> Configure Keys
          </button>

          <button className={styles.configBtn} onClick={handleAdminLogout} style={{ border: '1px solid var(--color-error-alpha)', color: 'var(--color-error)' }}>
            <LogOut size={14} /> Logout Admin
          </button>
          
          <button className={styles.backHomeBtn} onClick={() => navigate('/app')}>
            <ArrowLeft size={14} /> Back to Editor
          </button>
        </div>
      </aside>

      {/* PANE 2: Threads list pane */}
      <section className={styles.threadsPane}>
        <div className={styles.searchHeader}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={15} />
            <input
              type="text"
              placeholder="Search support mails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Categories Row */}
          <div className={styles.categoryPills}>
            {['all', 'Bug', 'Preset Request', 'Feature Request', 'General'].map(cat => (
              <button
                key={cat}
                className={[styles.categoryPill, selectedCategory === cat ? styles.categoryPillActive : ''].join(' ')}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'All categories' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Scrollable list */}
        <div className={styles.threadsList}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
              <span style={{ fontSize: '0.8rem' }}>Syncing emails...</span>
            </div>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map(ticket => {
              const lastMsg = ticket.messages[ticket.messages.length - 1];
              const initials = ticket.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
              
              // Time formatting helper
              const getTimeAgo = (dateStr: string) => {
                const diffMs = Date.now() - new Date(dateStr).getTime();
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins}m ago`;
                const diffHours = Math.floor(diffMins / 60);
                if (diffHours < 24) return `${diffHours}h ago`;
                return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              };

              return (
                <div
                  key={ticket.id}
                  className={[
                    styles.threadCard,
                    selectedTicketId === ticket.id ? styles.threadCardSelected : ''
                  ].join(' ')}
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    if (ticket.unread) {
                      if (provider === 'local') supportDbService.markAsRead(ticket.id, true);
                      else ticket.unread = false;
                    }
                  }}
                >
                  {ticket.unread && <span className={styles.unreadDot} />}
                  
                  <div
                    className={styles.avatar}
                    style={{ background: getAvatarGradient(ticket.name) }}
                  >
                    {initials}
                  </div>

                  <div className={styles.threadMeta}>
                    <div className={styles.threadHeader}>
                      <span className={styles.senderName}>{ticket.name}</span>
                      <span className={styles.time}>{getTimeAgo(ticket.updatedAt)}</span>
                    </div>

                    <div className={[
                      styles.subject,
                      ticket.unread ? styles.subjectUnread : ''
                    ].join(' ')}>
                      {ticket.subject}
                    </div>

                    <div className={[
                      styles.snippet,
                      ticket.unread ? styles.snippetUnread : ''
                    ].join(' ')}>
                      {lastMsg ? lastMsg.body : 'No messages'}
                    </div>

                    <div className={styles.badgesRow}>
                      {/* Category */}
                      <span className={[
                        styles.badge,
                        ticket.category === 'Bug' ? styles.badgeBug :
                        ticket.category === 'Preset Request' ? styles.badgePreset :
                        ticket.category === 'Feature Request' ? styles.badgeFeature :
                        styles.badgeGeneral
                      ].join(' ')}>
                        {ticket.category}
                      </span>

                      {/* Priority */}
                      <span className={[
                        styles.badge,
                        ticket.priority === 'High' ? styles.priorityHigh :
                        ticket.priority === 'Medium' ? styles.priorityMedium :
                        styles.priorityLow
                      ].join(' ')} style={{ border: '1px solid currentColor', background: 'transparent' }}>
                        {ticket.priority} Priority
                      </span>

                      {/* Source */}
                      <span className={styles.badge} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}>
                        {ticket.source.toUpperCase()}
                      </span>

                      {/* Status */}
                      <span className={styles.badge} style={{
                        background: ticket.status === 'Resolved' ? 'var(--color-success-alpha)' : ticket.status === 'Pending' ? 'var(--color-warning-alpha)' : 'var(--color-error-alpha)',
                        color: ticket.status === 'Resolved' ? 'var(--color-success)' : ticket.status === 'Pending' ? 'var(--color-warning)' : 'var(--color-error)'
                      }}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <button
                      className={[styles.starBtn, ticket.starred ? styles.starBtnActive : ''].join(' ')}
                      onClick={(e) => handleToggleStarred(ticket.id, e)}
                    >
                      <Star size={14} fill={ticket.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.noTickets}>
              <Mail size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
              <p>No support tickets found matching criteria.</p>
            </div>
          )}
        </div>
      </section>

      {/* PANE 3: Detail chat pane */}
      <section className={styles.detailPane}>
        {selectedTicket ? (
          <>
            {/* Header info */}
            <div className={styles.detailHeader}>
              <div className={styles.detailHeaderLeft}>
                <h3 className={styles.detailSubject}>{selectedTicket.subject}</h3>
                <div className={styles.detailSenderInfo}>
                  <span style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: '0.15rem 0.4rem', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-accent-light)' }}>
                    ID: {selectedTicket.id}
                  </span>
                  <span style={{ color: 'var(--color-border)', opacity: 0.5 }}>|</span>
                  <span>Submitted by <strong>{selectedTicket.name}</strong></span>
                  <span className={styles.detailEmail}>&lt;{selectedTicket.email}&gt;</span>
                </div>
              </div>

              <div className={styles.detailHeaderRight}>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value as any)}
                  className={styles.statusSelect}
                >
                  <option value="Open">🔴 Open</option>
                  <option value="Pending">🟡 Pending</option>
                  <option value="Resolved">🟢 Resolved</option>
                </select>

                <button
                  className={[styles.actionBtn, selectedTicket.starred ? styles.starBtnActive : ''].join(' ')}
                  onClick={(e) => handleToggleStarred(selectedTicket.id, e)}
                  title="Star ticket"
                >
                  <Star size={16} fill={selectedTicket.starred ? 'currentColor' : 'none'} />
                </button>

                <button
                  className={[styles.actionBtn, styles.deleteBtn].join(' ')}
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                  title="Delete ticket"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Conversation Flow */}
            <div className={styles.messagesTimeline}>
              {selectedTicket.messages.map(msg => (
                <div
                  key={msg.id}
                  className={[
                    styles.messageBubbleWrapper,
                    msg.sender === 'admin' ? styles.adminBubbleWrapper : styles.userBubbleWrapper
                  ].join(' ')}
                >
                  <div className={styles.bubbleHeader}>
                    <span className={styles.bubbleName}>
                      {msg.sender === 'admin' ? 'You' : msg.senderName}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <div className={[
                    styles.messageBubble,
                    msg.sender === 'admin' ? styles.adminBubble : styles.userBubble
                  ].join(' ')}>
                    {msg.body}
                    
                    {msg.sender === 'admin' && (
                      <div className={styles.adminBubbleMeta}>
                        <Check size={10} /> Sent via {msg.source.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={timelineEndRef} />
            </div>

            {/* Composer */}
            <div className={styles.composer}>
              <div className={styles.composerHeader}>
                <div className={styles.composerInfo}>
                  <CornerDownLeft size={12} className={styles.composerProviderIcon} />
                  <span>
                    Reply to <strong>{selectedTicket.email}</strong> via{' '}
                    {selectedTicket.source === 'local'
                      ? 'Local Database Simulation'
                      : selectedTicket.source === 'gmail'
                      ? gmailToken ? 'Real Gmail API' : 'Simulated Gmail Account (Sandbox)'
                      : outlookToken ? 'Real Outlook Graph API' : 'Simulated Outlook Account (Sandbox)'
                    }
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={cannedResponse}
                    onChange={(e) => handleSelectCanned(e.target.value)}
                    className={styles.templateSelect}
                  >
                    {CANNED_RESPONSES.map((r, idx) => (
                      <option key={idx} value={r.value}>{r.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleDraftWithGroq}
                    disabled={isGeneratingReply || !groqApiKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'linear-gradient(135deg, var(--color-accent) 0%, #a855f7 100%)',
                      border: 'none',
                      color: '#fff',
                      cursor: groqApiKey ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      opacity: groqApiKey ? 1 : 0.4,
                      transition: 'all var(--transition-fast)'
                    }}
                    title={groqApiKey ? "Generate automated reply using Groq AI" : "Configure your Groq API Key in Connection Settings to use AI Assist"}
                  >
                    {isGeneratingReply ? (
                      <>
                        <span className={styles.loadingSpinner} style={{ width: '10px', height: '10px', border: '1px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', marginRight: '0.2rem' }} />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <span>✨</span> Groq Reply
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.textareaWrapper}>
                <textarea
                  className={styles.composerTextarea}
                  placeholder={`Type your reply to ${selectedTicket.name} here...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={isSending}
                />
              </div>

              <div className={styles.composerFooter}>
                <label className={styles.signatureToggle}>
                  <input
                    type="checkbox"
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                    className={styles.signatureCheckbox}
                    disabled={isSending}
                  />
                  <span>Attach custom signature</span>
                </label>

                <button
                  className={styles.sendBtn}
                  onClick={handleSendReply}
                  disabled={isSending || !replyText.trim()}
                >
                  {isSending ? (
                    <>
                      <span className={styles.loadingSpinner} style={{ width: '12px', height: '12px', border: '1px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon} style={{ background: 'rgba(124, 111, 247, 0.03)', padding: '2rem', borderRadius: '50%', border: '1px solid var(--color-border)' }}>
              <Mail size={48} />
            </div>
            <h3 className={styles.emptyTitle}>Support Console</h3>
            <p style={{ maxWidth: '320px', margin: '0 auto', fontSize: '0.85rem' }}>
              Select a conversation from the threads list on the left to read user queries and send direct replies.
            </p>
          </div>
        )}
      </section>

      {/* MODAL: Settings Config */}
      {showSettings && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>API Connection Settings</h3>
              <button className={styles.closeModalBtn} onClick={() => setShowSettings(false)}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.infoAlert}>
                <Info size={14} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                To make <strong>real mail connections</strong> client-side, input your OAuth Client IDs. If left blank, the inbox will run in high-fidelity mock sandbox mode.
              </div>

              {/* GMAIL API CLIENT ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔴</span> Gmail Integration
                </h4>
                
                <div className={styles.formField}>
                  <label className={styles.formLabel}>OAuth 2.0 Client ID</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Enter Google Client ID..."
                    value={gmailClientId}
                    onChange={(e) => setGmailClientId(e.target.value)}
                  />
                  <p className={styles.helpText}>
                    Create a Web Application client ID in your <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className={styles.helpLink}>Google Cloud Console</a>. Add redirect URI: <code style={{ color: 'var(--color-text-primary)' }}>{window.location.origin}/admin/inbox</code>
                  </p>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Filter Search Query</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={gmailSearchQuery}
                    onChange={(e) => setGmailSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* OUTLOOK GRAPH API CLIENT ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔵</span> Outlook Integration
                </h4>
                
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Application (Client) ID</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Enter MS Entra Client ID..."
                    value={outlookClientId}
                    onChange={(e) => setOutlookClientId(e.target.value)}
                  />
                  <p className={styles.helpText}>
                    Register a Single Page Application in <a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer" className={styles.helpLink}>Microsoft Entra Portal</a>. Add Redirect URL: <code style={{ color: 'var(--color-text-primary)' }}>{window.location.origin}/admin/inbox</code>
                  </p>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Filter Search Query</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={outlookSearchQuery}
                    onChange={(e) => setOutlookSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* GROQ AI API KEY */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--color-border)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-accent-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✨</span> Groq AI Assist
                </h4>
                
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Groq API Key</label>
                  <input
                    type="password"
                    className={styles.formInput}
                    placeholder="Enter Groq API Key..."
                    value={groqApiKey}
                    onChange={(e) => setGroqApiKey(e.target.value)}
                  />
                  <p className={styles.helpText}>
                    Get your API key from the <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className={styles.helpLink}>Groq Console</a> to enable automated reply drafting.
                  </p>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Groq Model</label>
                  <input
                    type="text"
                    list="groq-models"
                    className={styles.formInput}
                    placeholder="Select or type model (e.g. llama-3.3-70b-versatile)..."
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                  />
                  <datalist id="groq-models">
                    <option value="llama-3.3-70b-versatile" />
                    <option value="llama-3.1-8b-instant" />
                    <option value="mixtral-8x7b-32768" />
                    <option value="gemma2-9b-it" />
                  </datalist>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelModalBtn} onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleSaveSettings}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={[
          styles.toast,
          toast.type === 'success' ? styles.toastSuccess : styles.toastError
        ].join(' ')}>
          <span className={styles.toastIcon}>
            {toast.type === 'success' ? (
              <CheckCircle className={styles.toastSuccessIcon} size={18} />
            ) : (
              <AlertCircle className={styles.toastErrorIcon} size={18} />
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Auto Trigger Connection prompts on selection */}
      {provider === 'gmail' && !gmailToken && (
        <div className={styles.toast} style={{ bottom: '5.5rem', borderLeft: '4px solid var(--color-warning)' }}>
          <AlertTriangle style={{ color: 'var(--color-warning)' }} size={16} />
          <span>Gmail disconnected. <button onClick={handleConnectGmail} style={{ textDecoration: 'underline', color: 'var(--color-accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Sign in with Google</button></span>
        </div>
      )}

      {provider === 'outlook' && !outlookToken && (
        <div className={styles.toast} style={{ bottom: '5.5rem', borderLeft: '4px solid var(--color-warning)' }}>
          <AlertTriangle style={{ color: 'var(--color-warning)' }} size={16} />
          <span>Outlook disconnected. <button onClick={handleConnectOutlook} style={{ textDecoration: 'underline', color: 'var(--color-accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Sign in with Microsoft</button></span>
        </div>
      )}
    </div>
  );
};
