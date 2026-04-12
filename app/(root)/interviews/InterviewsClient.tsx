'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import InterviewCard from '@/components/InterviewCard';
import type { InterviewSessionMode } from '@/lib/utils';

interface Interview {
  id: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt: string;
  sessionMode?: InterviewSessionMode | null;
  feedback?: {
    totalScore?: number;
    finalAssessment?: string;
    createdAt?: Date | number | string;
  } | null;
  techIcons?: Array<{ tech: string; url: string }>;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface InterviewsClientProps {
  userInterviews: Interview[];
  allInterviews: Interview[];
  user: User | null;
}

export default function InterviewsClient({ userInterviews, allInterviews, user }: InterviewsClientProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [searchQuery, setSearchQuery] = useState('');

  const displayedInterviews = activeTab === 'my' ? userInterviews : allInterviews;
  const filteredInterviews = displayedInterviews.filter(interview =>
    interview.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    interview.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen relative">
      <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                  Your
                  <span className="block bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Interviews
                  </span>
                </h1>
                <p className="text-gray-400">Manage and review all your mock interviews</p>
              </div>
              
              <Link
                href="/interviews/generate"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5" />
                Generate Interview
              </Link>
            </div>

            {/* Tabs and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Tabs */}
              <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('my')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'my'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  My Interviews ({userInterviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    activeTab === 'all'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All Interviews ({allInterviews.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search interviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                />
              </div>
            </div>
          </motion.div>

          {/* Interview Cards Grid */}
          {filteredInterviews.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredInterviews.map((interview, index) => (
                <motion.div
                  key={interview.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <InterviewCard
                    userId={user?.id || ''}
                    interviewId={interview.id}
                    role={interview.role}
                    type={interview.type}
                    techstack={interview.techstack}
                    createdAt={interview.createdAt}
                    feedback={interview.feedback}
                    techIcons={interview.techIcons}
                    sessionMode={interview.sessionMode}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                <Search className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">No interviews found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery ? 'Try adjusting your search' : 'Start your first interview to see it here'}
              </p>
              {!searchQuery && (
                <Link
                  href="/interviews/generate"
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all inline-flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-5 h-5" />
                  Create Your First Interview
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
