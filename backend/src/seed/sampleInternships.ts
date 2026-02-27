import Internship from '../models/Internship';

export async function seedSampleInternships() {
  const count = await Internship.estimatedDocumentCount();
  if (count > 0) {
    return;
  }

  const items = [
    {
      title: 'Software Engineering Intern',
      company: 'TechNova Labs',
      location: 'Nairobi, Kenya',
      source: 'sample',
      description:
        'Work with our product engineering team to build web applications using React and Node.js. Collaborate on new features, write tests, and participate in code reviews.',
      skillsRequired: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Git'],
      seniority: 'intern',
      isRemote: true,
      applyUrl: 'https://example.com/apply/technova-se-intern',
      postedAt: new Date(),
    },
    {
      title: 'Data Science Intern',
      company: 'Insight Analytics',
      location: 'Remote',
      source: 'sample',
      description:
        'Assist our data science team with exploratory data analysis, building predictive models, and presenting insights to business stakeholders.',
      skillsRequired: ['Python', 'Pandas', 'SQL', 'Machine Learning'],
      seniority: 'intern',
      isRemote: true,
      applyUrl: 'https://example.com/apply/insight-ds-intern',
      postedAt: new Date(),
    },
    {
      title: 'Frontend Developer Intern',
      company: 'PixelCraft Studio',
      location: 'Berlin, Germany',
      source: 'sample',
      description:
        'Contribute to visually stunning and accessible web interfaces. Work closely with designers to implement responsive layouts using React and Tailwind CSS.',
      skillsRequired: ['HTML', 'CSS', 'JavaScript', 'React', 'Tailwind CSS'],
      seniority: 'intern',
      isRemote: false,
      applyUrl: 'https://example.com/apply/pixelcraft-fe-intern',
      postedAt: new Date(),
    },
  ];

  await Internship.insertMany(items);
}

