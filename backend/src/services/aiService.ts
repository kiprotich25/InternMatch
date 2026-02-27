import { GoogleGenerativeAI } from '@google/generative-ai';
import { IUser } from '../models/User';
import { IInternship } from '../models/Internship';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function getModel() {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
}

export async function scoreMatch(user: IUser, internship: IInternship): Promise<number> {
  const prompt = `
You are an AI matching engine for internships.
Rate how well this student fits this internship on a scale of 0 to 100.
Return only the number.

Student profile:
- Course: ${user.course}
- Skills: ${user.skills.join(', ')}
- Preferred locations: ${user.preferredLocations.join(', ')}

Internship:
- Title: ${internship.title}
- Company: ${internship.company}
- Location: ${internship.location}
- Description: ${internship.description}
- Skills required: ${internship.skillsRequired.join(', ')}
  `;

  const model = getModel();
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const num = parseInt(text, 10);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

export async function generateCvImprovements(user: IUser, internship: IInternship, resumeText?: string) {
  const prompt = `
You are a career coach helping a student tailor their CV for a specific internship.

Student profile:
- Name: ${user.name}
- Course: ${user.course}
- Skills: ${user.skills.join(', ')}

Internship:
- Title: ${internship.title}
- Company: ${internship.company}
- Description: ${internship.description}
- Skills required: ${internship.skillsRequired.join(', ')}

Student resume (optional, may be empty):
${resumeText || 'No resume text provided.'}

Provide:
1) A short summary of top 3 strengths for this role.
2) A bullet list of concrete CV improvements (headings, bullet points, phrasing).
3) Optional project ideas they could add within 2–4 weeks.
  `;

  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateApplicationEmail(user: IUser, internship: IInternship) {
  const prompt = `
Write a concise, professional application email for this student to apply for the below internship.

Student:
- Name: ${user.name}
- Course: ${user.course}
- Skills: ${user.skills.join(', ')}

Internship:
- Title: ${internship.title}
- Company: ${internship.company}
- Description: ${internship.description}

Guidelines:
- 150–220 words.
- Use a warm but professional tone.
- Clearly connect 2–3 of the student's skills/projects to the role.
- Do not invent company details; rely only on provided info.
  `;

  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateInterviewQuestions(internship: IInternship, count = 8) {
  const prompt = `
You are an interview coach generating mock interview questions.

Internship:
- Title: ${internship.title}
- Company: ${internship.company}
- Description: ${internship.description}
- Skills required: ${internship.skillsRequired.join(', ')}

Generate ${count} interview questions:
- A mix of behavioral (STAR) and technical questions.
- Tailored specifically to this internship and company.
- Return as a numbered list, no answers.
  `;

  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function reviewInterviewAnswer(question: string, answer: string, internship: IInternship) {
  const prompt = `
You are an interview coach reviewing a student's answer.

Internship:
- Title: ${internship.title}
- Company: ${internship.company}
- Description: ${internship.description}

Question:
${question}

Student answer:
${answer}

Provide:
1) A score from 0–10 (just the number on its own line).
2) 3–5 bullet points of specific feedback.
3) A suggested improved version of the answer (same length range).
  `;

  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateNetworkingSuggestions(user: IUser, internship: IInternship) {
  const prompt = `
You are a career mentor helping a student with networking for an internship.

Student:
- Name: ${user.name}
- Course: ${user.course}
- Skills: ${user.skills.join(', ')}

Internship:
- Title: ${internship.title}
- Company: ${internship.company}
- Description: ${internship.description}

Provide:
1) A short strategy on who to reach out to (alumni, engineers, recruiters).
2) 2 short LinkedIn connection note templates.
3) 1 longer outreach message they can send after connecting.
  `;

  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

