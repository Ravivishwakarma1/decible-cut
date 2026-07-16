export interface SupportMessage {
  id: string;
  sender: 'user' | 'admin';
  senderName: string;
  senderEmail: string;
  body: string;
  timestamp: string;
  source: 'local' | 'gmail' | 'outlook';
}

export interface SupportTicket {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: 'Bug' | 'Preset Request' | 'Feature Request' | 'Feedback' | 'General' | 'Other';
  status: 'Open' | 'Pending' | 'Resolved';
  priority: 'Low' | 'Medium' | 'High';
  starred: boolean;
  unread: boolean;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
  source: 'local' | 'gmail' | 'outlook';
}

const STORAGE_KEY = 'decibelcut_support_tickets';

const SEED_TICKETS: SupportTicket[] = [];

export const supportDbService = {
  getAllTickets(): SupportTicket[] {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this.saveTickets(SEED_TICKETS);
      return SEED_TICKETS;
    }
    try {
      const tickets: SupportTicket[] = JSON.parse(data);
      const filtered = tickets.filter(t => !['t-1', 't-2', 't-3'].includes(t.id));
      if (filtered.length !== tickets.length) {
        this.saveTickets(filtered);
      }
      return filtered;
    } catch (e) {
      console.error('Error parsing support tickets, resetting to seed data', e);
      this.saveTickets(SEED_TICKETS);
      return SEED_TICKETS;
    }
  },

  saveTickets(tickets: SupportTicket[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  },

  getTicketById(id: string): SupportTicket | undefined {
    return this.getAllTickets().find(t => t.id === id);
  },

  createTicket(ticket: Omit<SupportTicket, 'id' | 'status' | 'priority' | 'starred' | 'unread' | 'messages' | 'createdAt' | 'updatedAt' | 'source'> & { message: string }): SupportTicket {
    const tickets = this.getAllTickets();
    
    // Auto-detect priority from keywords
    let priority: 'Low' | 'Medium' | 'High' = 'Low';
    const content = (ticket.subject + ' ' + ticket.category).toLowerCase();
    if (content.includes('error') || content.includes('fail') || content.includes('crash') || content.includes('bug') || content.includes('broken')) {
      priority = 'High';
    } else if (content.includes('preset') || content.includes('request') || content.includes('feature')) {
      priority = 'Medium';
    }

    const newTicket: SupportTicket = {
      ...ticket,
      id: `t-${Date.now()}`,
      status: 'Open',
      priority,
      starred: false,
      unread: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'local',
      messages: [
        {
          id: `m-${Date.now()}-1`,
          sender: 'user',
          senderName: ticket.name,
          senderEmail: ticket.email,
          body: (ticket as any).message || '', // Support temp passing message body
          timestamp: new Date().toISOString(),
          source: 'local'
        }
      ]
    };

    // Remove the temporary message field if it's there
    delete (newTicket as any).message;

    tickets.unshift(newTicket);
    this.saveTickets(tickets);
    return newTicket;
  },

  addReply(ticketId: string, replyText: string, sender: 'user' | 'admin' = 'admin', senderName: string = 'DecibelCut Admin', senderEmail: string = 'support@deciblecut.com'): SupportTicket | undefined {
    const tickets = this.getAllTickets();
    const index = tickets.findIndex(t => t.id === ticketId);
    
    if (index === -1) return undefined;

    const ticket = tickets[index];
    const newMsg: SupportMessage = {
      id: `m-${Date.now()}`,
      sender,
      senderName,
      senderEmail,
      body: replyText,
      timestamp: new Date().toISOString(),
      source: ticket.source
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = new Date().toISOString();
    
    if (sender === 'admin') {
      ticket.unread = false;
      ticket.status = 'Pending'; // Pending user response
    } else {
      ticket.unread = true; // Admin needs to see user reply
      ticket.status = 'Open';
    }

    tickets[index] = ticket;
    this.saveTickets(tickets);
    return ticket;
  },

  updateTicketStatus(id: string, status: 'Open' | 'Pending' | 'Resolved'): SupportTicket | undefined {
    const tickets = this.getAllTickets();
    const ticket = tickets.find(t => t.id === id);
    if (ticket) {
      ticket.status = status;
      ticket.updatedAt = new Date().toISOString();
      this.saveTickets(tickets);
    }
    return ticket;
  },

  toggleStarred(id: string): SupportTicket | undefined {
    const tickets = this.getAllTickets();
    const ticket = tickets.find(t => t.id === id);
    if (ticket) {
      ticket.starred = !ticket.starred;
      this.saveTickets(tickets);
    }
    return ticket;
  },

  markAsRead(id: string, read: boolean = true): SupportTicket | undefined {
    const tickets = this.getAllTickets();
    const ticket = tickets.find(t => t.id === id);
    if (ticket) {
      ticket.unread = !read;
      this.saveTickets(tickets);
    }
    return ticket;
  },

  deleteTicket(id: string): void {
    const tickets = this.getAllTickets();
    const filtered = tickets.filter(t => t.id !== id);
    this.saveTickets(filtered);
  }
};
