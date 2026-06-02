import { useState } from 'react'
import { Copy, Check, Webhook, Info } from 'lucide-react'
import Card, { SectionHeading } from '../components/ui/Card.jsx'
import Button from '../components/ui/Button.jsx'

const WEBHOOK_URL = 'https://pulse-calendar-gateway.netlify.app/api/vapi'

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getCurrentTime',
      description:
        'Returns the current date and time in the business timezone. Call this at the start of every conversation before asking about preferred days, so you can correctly interpret relative dates like "tomorrow" or "next Monday".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkAvailability',
      description:
        'Check available appointment slots. Call this when the caller mentions a preferred day or time period. Always call this before bookAppointment.',
      parameters: {
        type: 'object',
        properties: {
          preferredDay: {
            type: 'string',
            description:
              'Date in YYYY-MM-DD format. Infer from what the caller says ("tomorrow", "next Monday", etc.) using the current date as reference.',
          },
          preferredPeriod: {
            type: 'string',
            enum: ['morning', 'afternoon'],
            description: 'morning = before noon, afternoon = noon onwards.',
          },
          timezone: {
            type: 'string',
            description:
              "Caller's IANA timezone, e.g. America/New_York. Infer from their area code or ask directly.",
          },
        },
        required: ['preferredDay', 'preferredPeriod', 'timezone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bookAppointment',
      description:
        'Book the appointment after the caller confirms a specific slot from checkAvailability. Never call this without first calling checkAvailability and getting caller confirmation.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "Caller's full name.",
          },
          businessName: {
            type: 'string',
            description: "Caller's business name.",
          },
          email: {
            type: 'string',
            description: "Caller's email address for the calendar invite.",
          },
          phone: {
            type: 'string',
            description: "Caller's phone or WhatsApp number.",
          },
          slotStart: {
            type: 'string',
            description:
              'ISO datetime string for the slot start. Use the exact slot_start value returned by checkAvailability.',
          },
          slotEnd: {
            type: 'string',
            description:
              'ISO datetime string for the slot end. Use the exact slot_end value returned by checkAvailability.',
          },
          timezone: {
            type: 'string',
            description: "Caller's IANA timezone.",
          },
          notes: {
            type: 'string',
            description:
              'Brief summary of the conversation: what the caller does, why they are interested, any relevant context.',
          },
        },
        required: ['name', 'businessName', 'email', 'phone', 'slotStart', 'slotEnd', 'timezone'],
      },
    },
  },
]

function CopyBlock({ label, value, mono = true }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </Button>
      </div>
      <pre style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 16px',
        fontSize: 12,
        color: 'var(--teal-light)',
        overflowX: 'auto',
        fontFamily: mono ? 'monospace' : "'Barlow', sans-serif",
        margin: 0,
        lineHeight: 1.6,
        whiteSpace: mono ? 'pre' : 'pre-wrap',
      }}>
        {value}
      </pre>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 28 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: 'var(--teal-dim)', border: '1px solid rgba(25,211,197,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16,
        color: 'var(--teal)', fontWeight: 400,
      }}>
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400,
          fontSize: 18, color: 'var(--white)', margin: '4px 0 12px', letterSpacing: '0.02em',
        }}>
          {title}
        </p>
        {children}
      </div>
    </div>
  )
}

export default function VapiSetup() {
  return (
    <div>
      <SectionHeading sub="Connect Pulse to the scheduling engine via VAPI tool calls">VAPI Integration</SectionHeading>

      {/* How it works */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Info size={16} color="var(--teal)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ margin: '0 0 8px', color: 'var(--white)', fontSize: 14, fontWeight: 400 }}>How it works</p>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
              When Pulse needs to check availability or book an appointment, VAPI makes a POST request to the
              PCG webhook. PCG runs the scheduling logic, talks to Google Calendar, and returns a plain-language
              result that Pulse reads back to the caller. The AI never touches the calendar directly.
            </p>
          </div>
        </div>
      </Card>

      <Step n="1" title="Set the Server URL in your VAPI assistant">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          In the VAPI dashboard, open your assistant → <strong style={{ color: 'var(--white)' }}>Advanced → Server URL</strong>.
          Paste the webhook URL below.
        </p>
        <CopyBlock label="Webhook URL" value={WEBHOOK_URL} />
      </Step>

      <Step n="2" title="Add a VAPI Secret (recommended)">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          In VAPI assistant settings, set a <strong style={{ color: 'var(--white)' }}>Server Secret</strong>.
          VAPI will include it as <code style={{ color: 'var(--teal)', fontSize: 12 }}>x-vapi-secret</code> on every request.
          Add the same value as a Netlify environment variable so PCG can verify it.
        </p>
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '12px 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7,
        }}>
          Netlify → pulse-calendar-gateway → Environment variables → Add{' '}
          <code style={{ color: 'var(--teal)', fontSize: 12 }}>VAPI_SECRET</code> = your chosen secret string
        </div>
      </Step>

      <Step n="3" title="Link your VAPI assistant to a PCG client">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          PCG uses the VAPI <strong style={{ color: 'var(--white)' }}>Assistant ID</strong> to look up which
          client config (calendar, business hours, timezone) to use. Copy the assistant ID from VAPI and paste
          it into the <strong style={{ color: 'var(--white)' }}>Assistant ID</strong> field on the Clients page.
        </p>
        <div style={{
          background: 'var(--teal-dim)', border: '1px solid rgba(25,211,197,0.2)',
          borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--teal-light)',
        }}>
          Clients → Edit client → Assistant ID field → paste VAPI assistant ID → Save
        </div>
      </Step>

      <Step n="4" title="Add the tool definitions to your VAPI assistant">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          In the VAPI assistant editor, go to <strong style={{ color: 'var(--white)' }}>Tools</strong> and add
          these three function definitions. VAPI will automatically call them during conversations when appropriate.
        </p>
        <CopyBlock
          label="Tool definitions — paste into VAPI Tools (JSON)"
          value={JSON.stringify(TOOL_DEFINITIONS, null, 2)}
        />
      </Step>

      <Step n="5" title="Test the connection">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          Make a test call to your VAPI assistant. Ask it to book an appointment — for example:{' '}
          <em style={{ color: 'var(--white)' }}>"I'd like to schedule a call for tomorrow morning."</em>
          Pulse should call <code style={{ color: 'var(--teal)', fontSize: 12 }}>checkAvailability</code>,
          read out two slots, and after you confirm, call <code style={{ color: 'var(--teal)', fontSize: 12 }}>bookAppointment</code>.
          The booking will appear on the PCG Dashboard and in your Google Calendar.
        </p>
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '12px 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7,
        }}>
          You can also simulate a VAPI tool call from the{' '}
          <strong style={{ color: 'var(--white)' }}>Test Booking</strong> page using the Check Availability
          and Book Appointment panels — same logic, direct API access.
        </div>
      </Step>

      {/* Webhook payload reference */}
      <Card style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
          <Webhook size={15} color="var(--teal)" />
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 400, fontSize: 18, color: 'var(--white)', margin: 0 }}>
            Webhook payload reference
          </h3>
        </div>
        <CopyBlock
          label="Example VAPI request body (tool-calls message)"
          value={JSON.stringify({
            message: {
              type: 'tool-calls',
              call: { assistantId: '<your-vapi-assistant-id>' },
              toolCallList: [
                {
                  id: 'toolu_01abc',
                  type: 'function',
                  function: {
                    name: 'checkAvailability',
                    arguments: '{"preferredDay":"2025-06-10","preferredPeriod":"morning","timezone":"America/New_York"}',
                  },
                },
              ],
            },
          }, null, 2)}
        />
        <CopyBlock
          label="PCG response format"
          value={JSON.stringify({
            results: [
              {
                toolCallId: 'toolu_01abc',
                result: 'Found 2 available slots:\nOption A: Tuesday, June 10 at 9:00 AM – 9:30 AM (America/New_York) | slot_start=2025-06-10T13:00:00.000Z | slot_end=2025-06-10T13:30:00.000Z\nOption B: ...',
              },
            ],
          }, null, 2)}
        />
      </Card>
    </div>
  )
}
