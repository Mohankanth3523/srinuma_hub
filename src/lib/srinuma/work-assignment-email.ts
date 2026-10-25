import nodemailer from 'nodemailer';

type AssignmentEmail = {
  recipient: string;
  employeeName: string;
  workId: string;
  title: string;
  dueDate: string;
};

/** Call only AFTER a work assignment has been committed to Google Sheets. */
export async function sendWorkAssignmentEmail({recipient,employeeName,workId,title,dueDate}:AssignmentEmail):Promise<'sent'|'missing_email'|'failed'> {
  const to=recipient.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return 'missing_email';
  const user=process.env.SRINUMA_SMTP_USER||process.env.SMTP_USER||process.env.GMAIL_USER||'';
  const pass=process.env.SRINUMA_SMTP_APP_PASSWORD||process.env.SMTP_APP_PASSWORD||process.env.GMAIL_APP_PASSWORD||'';
  if(!user||!pass){console.error('Work assignment mail: SMTP configuration missing');return 'failed';}
  const port=Number(process.env.SMTP_PORT||465);
  if(!Number.isInteger(port)||port<=0||port>65535){console.error('Work assignment mail: Invalid SMTP port');return 'failed';}
  const safeName=employeeName.trim()||'Team Member';
  const body=[
    `Hello ${safeName},`,
    '',
    'A new work has been assigned to you in SRINUMA HUB.',
    '',
    `Work ID: ${workId}`,
    `Work Title: ${title}`,
    'Status: Assigned',
    `Due Date: ${dueDate||'Not set'}`,
    '',
    'Please sign in to SRINUMA HUB to see the work details and reference files.',
    '',
    'SRINUMA Digital Solutions',
    'This is an automatic work assignment notification.'
  ].join('\n');
  let transport:ReturnType<typeof nodemailer.createTransport>|undefined;
  try{
    transport=nodemailer.createTransport({
      host:process.env.SMTP_HOST||'smtp.gmail.com',port,
      secure:port===465,auth:{user,pass},
      connectionTimeout:12000,greetingTimeout:12000,socketTimeout:15000
    });
    await transport.sendMail({
      from:process.env.SRINUMA_MAIL_FROM||user,
      to,
      subject:`SRINUMA HUB | New Work Assigned | ${workId}`,
      text:body,
    });
    return 'sent';
  }catch(e){
    // Never fail/re-create an already-saved work because delivery failed.
    console.error('SRINUMA work assignment email failed for work',workId,e instanceof Error?e.message:'SMTP failure');
    return 'failed';
  }finally{transport?.close();}
}
