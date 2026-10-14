import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { IncidentTicket } from '../types/telemetry';

export interface CopilotChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp?: string;
}

export interface CopilotSession {
  session_id: string;
  user_persona: string; // persona roleTitle or id
  title: string;
  updated_at: string;
  messages: CopilotChatMessage[];
}

const SESSIONS_COLLECTION = 'copilot_sessions';
const INCIDENTS_COLLECTION = 'incidents';

/**
 * Save or update a Copilot chat session in Firestore
 */
export async function saveCopilotSession(session: CopilotSession): Promise<void> {
  try {
    const sessionRef = doc(db, SESSIONS_COLLECTION, session.session_id);
    await setDoc(sessionRef, {
      session_id: session.session_id,
      user_persona: session.user_persona,
      title: session.title || 'New Triage Thread',
      updated_at: session.updated_at || new Date().toISOString(),
      messages: session.messages || [],
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving Copilot session:', err);
    // Non-blocking fallback
  }
}

/**
 * Fetch historical sessions filtered by persona
 */
export async function fetchCopilotSessions(userPersona: string): Promise<CopilotSession[]> {
  try {
    const colRef = collection(db, SESSIONS_COLLECTION);
    const q = query(
      colRef,
      where('user_persona', '==', userPersona),
      orderBy('updated_at', 'desc')
    );
    const snapshot = await getDocs(q);
    const sessions: CopilotSession[] = [];
    snapshot.forEach((docSnap) => {
      sessions.push(docSnap.data() as CopilotSession);
    });
    return sessions;
  } catch (err) {
    // If composite index is needed or sorting fallback
    try {
      const colRef = collection(db, SESSIONS_COLLECTION);
      const snapshot = await getDocs(colRef);
      const list: CopilotSession[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CopilotSession;
        if (data.user_persona === userPersona) {
          list.push(data);
        }
      });
      return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } catch (e2) {
      console.warn('[Firestore] Error fetching sessions fallback:', e2);
      return [];
    }
  }
}

/**
 * Real-time listener for Copilot sessions for the active persona
 */
export function listenToCopilotSessions(
  userPersona: string,
  callback: (sessions: CopilotSession[]) => void
): Unsubscribe {
  const colRef = collection(db, SESSIONS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const sessions: CopilotSession[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CopilotSession;
        if (data.user_persona === userPersona) {
          sessions.push(data);
        }
      });
      sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      callback(sessions);
    },
    (err) => {
      console.warn('[Firestore] Error listening to sessions:', err);
    }
  );
}

/**
 * Save an incident ticket to Firestore incidents collection
 */
export async function saveIncidentToFirestore(incident: IncidentTicket): Promise<void> {
  try {
    const incRef = doc(db, INCIDENTS_COLLECTION, incident.id || incident.incident_id);
    await setDoc(incRef, incident, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error saving incident:', err);
  }
}

/**
 * Update an existing incident ticket in Firestore
 */
export async function updateIncidentInFirestore(
  incidentId: string,
  updates: Partial<IncidentTicket>
): Promise<void> {
  try {
    const incRef = doc(db, INCIDENTS_COLLECTION, incidentId);
    await setDoc(incRef, updates, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Error updating incident:', err);
  }
}

/**
 * Real-time listener for incidents, tracking pending count and notifying on new additions
 */
export function listenToIncidents(
  onUpdate: (incidents: IncidentTicket[]) => void,
  onNewIncident?: (newIncident: IncidentTicket) => void
): Unsubscribe {
  const colRef = collection(db, INCIDENTS_COLLECTION);
  let isInitialLoad = true;

  return onSnapshot(
    colRef,
    (snapshot) => {
      const tickets: IncidentTicket[] = [];

      snapshot.docChanges().forEach((change) => {
        if (!isInitialLoad && change.type === 'added') {
          const ticket = change.doc.data() as IncidentTicket;
          if (ticket.status === 'AWAITING_APPROVAL' && onNewIncident) {
            onNewIncident(ticket);
          }
        }
      });

      snapshot.forEach((docSnap) => {
        tickets.push(docSnap.data() as IncidentTicket);
      });

      tickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      isInitialLoad = false;
      onUpdate(tickets);
    },
    (err) => {
      console.warn('[Firestore] Error listening to incidents:', err);
    }
  );
}

/**
 * Lightweight Auto-title generator using Gemini or heuristic fallback
 */
export async function generateAutoTitle(firstUserMessage: string): Promise<string> {
  try {
    const res = await fetch('/api/gemini/summarize-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: firstUserMessage }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.title && typeof data.title === 'string' && data.title.trim().length > 0) {
        return data.title.trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (err) {
    // Fallback
  }

  // Heuristic 3-5 words title
  const words = firstUserMessage.replace(/[^\w\s-]/g, '').trim().split(/\s+/);
  if (words.length <= 5) {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return words.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Inquiry';
}
