import * as React from 'react';
import EnglishReading from '@/components/article/english-reading'

export default function ReadingPage() {
  const sampleContent = [
    'Artificial intelligence (AI) is transforming various industries at an unprecedented pace. From healthcare to finance, AI technologies are revolutionizing how we work and live.',
    <React.Fragment key="machine-learning">
      One of the most significant developments in AI is{' '}
      <span className="underline decoration-sky-500 underline-offset-2 font-semibold">
        machine learning
      </span>
      , which allows computers to learn from data without being explicitly programmed. This technology powers everything from recommendation systems to autonomous vehicles.
    </React.Fragment>,
    'However, the rapid advancement of AI also raises important ethical questions. Issues such as data privacy, algorithmic bias, and job displacement need to be carefully considered as we move forward.',
    'Despite these challenges, the potential benefits of AI are enormous. In healthcare, AI can help diagnose diseases earlier and more accurately. In education, it can provide personalized learning experiences for students. And in environmental science, AI can help us better understand and address climate change.',
    'As we continue to develop and implement AI technologies, it is crucial that we do so responsibly and ethically, ensuring that these powerful tools benefit all of humanity.',
  ]

  return (
    <div className="min-h-screen bg-background py-8">
      <EnglishReading title="The Future of Artificial Intelligence" content={sampleContent} />
    </div>
  )
}