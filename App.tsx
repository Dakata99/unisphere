import React, { useState, useEffect, useMemo } from 'react';
import { Course, Note, Material, View } from './types.ts';
import { BookIcon, PlusIcon, NoteIcon, TrashIcon, LinkIcon, SparklesIcon } from './components/Icons.tsx';
import { summarizeNote, generateStudyQuestions } from './services/geminiService.ts';

// Unified blue theme constants
const THEME_COLOR = 'bg-blue-600';

interface MaterialItemProps {
  material: Material;
  onDelete: (id: string) => void;
}

/**
 * MaterialItem displays attached resources with high-contrast text and permanent badges.
 * Fixed: Explicitly typed with React.FC to allow 'key' prop during list rendering.
 */
const MaterialItem: React.FC<MaterialItemProps> = ({ material, onDelete }) => (
  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all group/mat shadow-sm">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
        {material.type === 'Link' ? <LinkIcon /> : <BookIcon />}
      </div>
      <div className="min-w-0">
        <a 
          href={material.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-sm font-bold text-slate-900 hover:text-blue-700 truncate max-w-[130px] block transition-colors"
        >
          {material.name}
        </a>
        {/* Permanent, high-contrast badge for type visibility */}
        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider mt-1 border border-slate-900">
          {material.type}
        </span>
      </div>
    </div>
    <button 
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(material.id); }}
      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
      aria-label="Delete resource"
    >
      <TrashIcon />
    </button>
  </div>
);

export default function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentView, setCurrentView] = useState<View>('catalog');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [targetNoteId, setTargetNoteId] = useState<string | null>(null);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [studyQuestions, setStudyQuestions] = useState<{question: string, answer: string}[]>([]);

  useEffect(() => {
    const savedCourses = localStorage.getItem('uni_courses');
    const savedNotes = localStorage.getItem('uni_notes');
    const savedMaterials = localStorage.getItem('uni_materials');
    if (savedCourses) setCourses(JSON.parse(savedCourses));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedMaterials) setMaterials(JSON.parse(savedMaterials));
  }, []);

  useEffect(() => {
    localStorage.setItem('uni_courses', JSON.stringify(courses));
    localStorage.setItem('uni_notes', JSON.stringify(notes));
    localStorage.setItem('uni_materials', JSON.stringify(materials));
  }, [courses, notes, materials]);

  const handleMoveNote = (relativeIndex: number, direction: 'up' | 'down') => {
    const courseNotesIndices = notes.reduce((acc, note, index) => {
      if (note.courseId === selectedCourseId) acc.push(index);
      return acc;
    }, [] as number[]);
    const globalIndex = courseNotesIndices[relativeIndex];
    const targetGlobalIndex = direction === 'up' ? courseNotesIndices[relativeIndex - 1] : courseNotesIndices[relativeIndex + 1];
    if (targetGlobalIndex === undefined) return;
    const newNotes = [...notes];
    [newNotes[globalIndex], newNotes[targetGlobalIndex]] = [newNotes[targetGlobalIndex], newNotes[globalIndex]];
    setNotes(newNotes);
  };

  const filteredCourses = useMemo(() => {
    const cleanQuery = searchQuery.toLowerCase().trim();
    if (!cleanQuery) return courses;
    return courses.filter(c => 
      c.name.toLowerCase().includes(cleanQuery) || 
      c.description.toLowerCase().includes(cleanQuery)
    );
  }, [courses, searchQuery]);

  const selectedCourse = useMemo(() => 
    courses.find(c => c.id === selectedCourseId), 
  [courses, selectedCourseId]);

  const currentCourseNotes = useMemo(() => 
    notes.filter(n => n.courseId === selectedCourseId), 
  [notes, selectedCourseId]);

  const handleAddCourse = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newCourse: Course = {
      id: crypto.randomUUID(),
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      color: THEME_COLOR,
      createdAt: Date.now(),
    };
    setCourses([...courses, newCourse]);
    setCurrentView('catalog');
  };

  const handleDeleteCourse = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Delete this course? All associated content will be lost.')) {
      setCourses(prev => prev.filter(c => c.id !== id));
      setNotes(prev => prev.filter(n => n.courseId !== id));
      setMaterials(prev => prev.filter(m => m.courseId !== id));
    }
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleSaveNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    if (activeNote) {
      setNotes(notes.map(n => n.id === activeNote.id ? { ...n, title, content, updatedAt: Date.now() } : n));
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        courseId: selectedCourseId!,
        title,
        content,
        updatedAt: Date.now(),
      };
      setNotes([...notes, newNote]);
    }
    setIsNoteModalOpen(false);
    setActiveNote(null);
  };

  const handleAddMaterial = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newMaterial: Material = {
      id: crypto.randomUUID(),
      courseId: selectedCourseId!,
      noteId: targetNoteId || undefined,
      name: formData.get('name') as string,
      url: formData.get('url') as string,
      type: formData.get('type') as any,
      addedAt: Date.now(),
    };
    setMaterials([...materials, newMaterial]);
    setIsMaterialModalOpen(false);
    setTargetNoteId(null);
  };

  const exportData = () => {
    const data = { courses, notes, materials };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unisphere_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runAISummary = async (content: string) => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const result = await summarizeNote(content);
      setAiSummary(result || "Failed to generate summary.");
    } catch (err) {
      alert("Error generating summary.");
    } finally {
      setAiLoading(false);
    }
  };

  const runAIQuestions = async (content: string) => {
    setAiLoading(true);
    setStudyQuestions([]);
    try {
      const result = await generateStudyQuestions(content);
      setStudyQuestions(result);
    } catch (err) {
      alert("Error generating questions.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setCurrentView('catalog')}>
            <div className={`w-11 h-11 ${THEME_COLOR} rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg transition-transform group-hover:scale-110`}>U</div>
            <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">UniSphere</span>
          </div>
          <button 
            onClick={exportData}
            className="text-[10px] font-black text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-[0.3em] flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            BACKUP
          </button>
        </div>
      </nav>

      <main className="pt-10">
        {currentView === 'catalog' && (
          <div className="max-w-6xl mx-auto p-6 transition-opacity duration-300">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Course Catalog</h1>
                <p className="text-slate-500 font-medium">Manage your active university modules</p>
              </div>
              <button 
                onClick={() => setCurrentView('add-course')}
                className={`flex items-center gap-2 ${THEME_COLOR} text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-blue-200 hover:scale-105 active:scale-95`}
              >
                <PlusIcon /> New course
              </button>
            </div>

            <div className="mb-12 relative group">
              <input 
                type="text"
                placeholder="Search by course name or description..."
                className="w-full pl-16 pr-6 py-6 rounded-3xl border-2 border-slate-200 focus:border-blue-600 outline-none transition-all text-xl shadow-md bg-white !text-slate-900 placeholder:text-slate-400 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute left-6 top-6 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.length > 0 ? filteredCourses.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => {
                    setSelectedCourseId(course.id);
                    setCurrentView('course-detail');
                  }}
                  className="group relative bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200 hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer flex flex-col min-h-[300px]"
                >
                  <div className={`p-4 rounded-2xl ${THEME_COLOR} text-white shadow-lg w-fit mb-8`}>
                    <BookIcon />
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 mb-4 group-hover:text-blue-600 transition-colors leading-tight pr-10">
                    {course.name}
                  </h3>
                  <p className="text-slate-600 text-sm line-clamp-4 mb-auto leading-relaxed font-medium">
                    {course.description || "No description provided."}
                  </p>

                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      ID: {course.id.slice(0,8)} • {new Date(course.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <button 
                    onClick={(e) => handleDeleteCourse(course.id, e)}
                    className="absolute top-6 right-6 z-[50] p-3 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all shadow-md border border-slate-200"
                    title="Delete Course"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )) : (
                <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-300">
                  <h3 className="text-slate-900 font-black text-2xl mb-2">No matching courses</h3>
                  <p className="text-slate-500 font-medium">Refine your search or add a new course.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'add-course' && (
          <div className="max-w-2xl mx-auto p-6">
            <button 
              onClick={() => setCurrentView('catalog')}
              className="mb-8 text-blue-600 hover:text-blue-700 font-black flex items-center gap-2 group transition-all"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span> CATALOG
            </button>
            <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-200">
              <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">New Course</h2>
              <p className="text-slate-500 font-medium mb-10">Setup your module workspace</p>
              <form onSubmit={handleAddCourse} className="space-y-8">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Course Name</label>
                  <input name="name" required placeholder="Introduction to Psychology..." className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none text-xl font-bold transition-all !text-slate-900 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Brief Description</label>
                  <textarea name="description" rows={4} placeholder="Summary of the module objectives..." className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none resize-none text-lg font-medium transition-all !text-slate-900 bg-white"></textarea>
                </div>
                <button type="submit" className={`w-full ${THEME_COLOR} text-white py-6 rounded-2xl font-black text-xl hover:scale-[1.02] transition-all shadow-xl active:scale-95`}>
                  CREATE WORKSPACE
                </button>
              </form>
            </div>
          </div>
        )}

        {currentView === 'course-detail' && selectedCourse && (
          <div className="max-w-5xl mx-auto p-6">
            <div className="mb-12">
              <button 
                onClick={() => setCurrentView('catalog')}
                className="mb-8 text-blue-600 hover:text-blue-700 font-black flex items-center gap-2 group transition-all"
              >
                <span className="group-hover:-translate-x-1 transition-transform">←</span> CATALOG
              </button>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-4">{selectedCourse.name}</h1>
              <p className="text-slate-600 text-xl font-medium max-w-2xl">{selectedCourse.description}</p>
            </div>

            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><NoteIcon /></div> 
                Entries
              </h2>
              <button 
                onClick={() => { setActiveNote(null); setIsNoteModalOpen(true); }}
                className={`flex items-center gap-2 ${THEME_COLOR} text-white px-6 py-3 rounded-2xl font-black hover:scale-105 transition-all shadow-lg active:scale-95`}
              >
                <PlusIcon /> New Entry
              </button>
            </div>

            <div className="space-y-12">
              {currentCourseNotes.length > 0 ? currentCourseNotes.map((note, idx) => (
                <div key={note.id} className="group/note bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200 hover:shadow-xl transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
                  
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{note.title}</h3>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleMoveNote(idx, 'up')}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100"
                        title="Move Up"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                      </button>
                      <button 
                        onClick={() => handleMoveNote(idx, 'down')}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100"
                        title="Move Down"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                      <button 
                        onClick={() => { setActiveNote(note); setIsNoteModalOpen(true); }}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-100"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button 
                        onClick={() => { runAISummary(note.content); runAIQuestions(note.content); }}
                        className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-all border border-amber-100"
                        title="Analyze Content"
                      >
                        <SparklesIcon />
                      </button>
                      <button 
                        onClick={() => { if(confirm('Delete entry?')) setNotes(notes.filter(n => n.id !== note.id)); }}
                        className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-100"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-10 mb-10 border border-slate-200">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Note Body Preview</h4>
                     <p className="text-slate-900 leading-relaxed whitespace-pre-wrap font-medium line-clamp-[10] text-lg italic bg-white/50 p-6 rounded-2xl border border-white">
                       {note.content}
                     </p>
                  </div>

                  <div className="border-t border-slate-100 pt-10">
                    <div className="flex justify-between items-center mb-6">
                       <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                         <LinkIcon /> Attached Resources
                       </h4>
                       <button 
                        onClick={() => { setTargetNoteId(note.id); setIsMaterialModalOpen(true); }}
                        className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 transition-all flex items-center gap-2"
                       >
                         <PlusIcon /> ADD RESOURCE
                       </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {materials.filter(m => m.noteId === note.id).map(mat => (
                        <MaterialItem key={mat.id} material={mat} onDelete={handleDeleteMaterial} />
                      ))}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-300">
                  <p className="text-slate-400 font-bold text-xl">Capture your first lecture entry to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] w-full max-w-5xl overflow-hidden shadow-2xl">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{activeNote ? 'Edit Entry' : 'New Entry'}</h3>
              <button onClick={() => setIsNoteModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-600 transition-all bg-white rounded-2xl shadow-sm border border-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleSaveNote} className="p-12">
              <div className="mb-10">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Subject</label>
                <input name="title" required defaultValue={activeNote?.title} placeholder="e.g. Fundamental Theorems..." className="w-full px-8 py-6 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none text-2xl font-black !text-slate-900 bg-slate-50" />
              </div>
              <div className="mb-12">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Content</label>
                <textarea name="content" required rows={12} defaultValue={activeNote?.content} placeholder="Enter detailed notes..." className="w-full px-8 py-6 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none resize-none font-mono text-lg leading-relaxed !text-slate-900 bg-slate-50"></textarea>
              </div>
              <div className="flex justify-end gap-6">
                <button type="button" onClick={() => setIsNoteModalOpen(false)} className="px-10 py-5 rounded-2xl text-slate-500 font-black hover:bg-slate-100 transition-all uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" className={`px-12 py-5 rounded-2xl ${THEME_COLOR} text-white font-black text-xl hover:scale-105 transition-all shadow-xl active:scale-95 uppercase tracking-tighter`}>Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Add Resource</h3>
               <button onClick={() => setIsMaterialModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
            </div>
            <form onSubmit={handleAddMaterial} className="p-8 space-y-8">
               <div>
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Label Name</label>
                 <input name="name" required placeholder="Course Syllabus" className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none font-bold !text-slate-900 bg-slate-50" />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Target URL / File Path</label>
                 <input name="url" required placeholder="https://..." className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none font-mono text-sm !text-slate-900 bg-slate-50" />
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Resource Type</label>
                 <select name="type" className="w-full px-6 py-5 rounded-2xl border-2 border-slate-200 focus:border-blue-600 outline-none bg-slate-50 appearance-none cursor-pointer font-bold !text-slate-900">
                    <option>Link</option>
                    <option>File</option>
                    <option>Reference</option>
                 </select>
               </div>
               <button type="submit" className={`w-full ${THEME_COLOR} text-white py-6 rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest`}>
                  Attach to Note
               </button>
            </form>
          </div>
        </div>
      )}

      {(aiSummary || studyQuestions.length > 0 || aiLoading) && (
        <div className="fixed bottom-10 right-10 z-[150] w-full max-w-lg">
           <div className="bg-slate-900 text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden border-4 border-blue-600">
              <button 
                onClick={() => { setAiSummary(null); setStudyQuestions([]); }}
                className="absolute top-8 right-8 p-3 text-white/30 hover:text-white transition-all bg-white/5 rounded-2xl"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <h3 className="text-2xl font-black mb-8 flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-900/50"><SparklesIcon /></div> 
                Insight Engine
              </h3>
              {aiLoading ? (
                <div className="flex flex-col items-center py-12 gap-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-500"></div>
                  <span className="text-blue-100 font-black tracking-widest uppercase text-xs">Synthesizing Notes...</span>
                </div>
              ) : (
                <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                  {aiSummary && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                      <h4 className="font-black text-blue-400 text-[10px] uppercase tracking-[0.3em] mb-6">Automated Summary</h4>
                      <div className="text-base leading-relaxed text-slate-200 prose prose-invert italic font-medium">
                        {aiSummary.split('\n').map((line, i) => <p key={i} className="mb-3">{line}</p>)}
                      </div>
                    </div>
                  )}
                  {studyQuestions.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                      <h4 className="font-black text-emerald-400 text-[10px] uppercase tracking-[0.3em] mb-6">Retention Quiz</h4>
                      <div className="space-y-6">
                        {studyQuestions.map((sq, i) => (
                          <div key={i} className="border-l-4 border-emerald-500/30 pl-6 py-2">
                            <p className="text-slate-100 font-bold text-sm mb-4">{sq.question}</p>
                            <details className="cursor-pointer group">
                              <summary className="text-[10px] text-emerald-400 font-black hover:text-emerald-300 transition-colors uppercase tracking-[0.2em] focus:outline-none list-none">
                                <span className="flex items-center gap-2">Show Answer <svg className="group-open:rotate-180 transition-transform" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
                              </summary>
                              <div className="mt-4 p-5 bg-emerald-500/10 rounded-2xl text-emerald-50 text-xs font-medium leading-relaxed border border-emerald-500/20 italic">
                                {sq.answer}
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
           </div>
        </div>
      )}

      <footer className="mt-32 px-6">
        <div className="max-w-6xl mx-auto border-t border-slate-200 pt-20 flex flex-col items-center gap-8">
           <div className="flex flex-wrap justify-center gap-12 text-[11px] font-black uppercase tracking-[0.5em] text-slate-300">
             <span className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> PRIVATE</span>
             <span className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> PERSISTENT</span>
             <span className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div> AI-POWERED</span>
           </div>
           <p className="text-slate-400 text-xs font-black tracking-widest opacity-50 uppercase">UniSphere • Workspace V1.6</p>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          border: 2px solid rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  );
}
