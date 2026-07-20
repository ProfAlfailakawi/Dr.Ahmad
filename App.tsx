/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  BookOpen, 
  GraduationCap, 
  Sparkles, 
  Cpu, 
  UserCheck, 
  Mail, 
  MapPin, 
  Menu, 
  X, 
  Award, 
  FileText, 
  ExternalLink, 
  Search, 
  ArrowUpRight,
  Book,
  Send,
  CheckCircle,
  Clock,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { portfolioData, Course, Publication } from "./data";

export default function App() {
  const [activeTab, setActiveTab] = useState<'all' | 'book' | 'paper'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Contact form state
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student',
    subject: '',
    message: ''
  });

  // Filter publications
  const filteredPublications = useMemo(() => {
    return portfolioData.publications.filter(pub => {
      const matchesTab = activeTab === 'all' || pub.type === activeTab;
      const matchesSearch = searchQuery.trim() === '' || 
        pub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  // Handle contact form submit
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setFormSubmitting(true);
    
    // Simulate API request
    setTimeout(() => {
      setFormSubmitting(false);
      setFormSubmitted(true);
      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'student',
        subject: '',
        message: ''
      });
    }, 1500);
  };

  // Icon selector helper
  const renderPhilosophyIcon = (iconName: string) => {
    switch (iconName) {
      case "UserCheck":
        return <UserCheck className="w-6 h-6 text-brand-accent" id="icon-user" />;
      case "Cpu":
        return <Cpu className="w-6 h-6 text-brand-accent" id="icon-cpu" />;
      case "Sparkles":
        return <Sparkles className="w-6 h-6 text-brand-accent" id="icon-sparkles" />;
      default:
        return <GraduationCap className="w-6 h-6 text-brand-accent" id="icon-default" />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-beige text-brand-dark selection:bg-brand-accent selection:text-white relative" id="app-root">
      
      {/* Decorative Elegant Frame lines */}
      <div className="fixed inset-0 pointer-events-none z-50 border-[12px] border-brand-beige" />
      <div className="fixed top-3 left-3 right-3 bottom-3 pointer-events-none z-40 border border-brand-accent/20" />

      {/* Modern Background Blur Shapes */}
      <div className="absolute top-[10%] left-[5%] w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] right-[5%] w-[450px] h-[450px] rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none" />

      {/* Top Banner / Academic Title */}
      <div className="bg-brand-dark text-brand-beige py-2 px-8 text-center text-xs tracking-widest font-serif border-b border-brand-accent/20 hidden md:block" id="top-banner">
        <span>{portfolioData.institution}</span>
      </div>

      {/* Header / Navigation */}
      <header className="sticky top-3 z-30 mx-3 md:mx-6 bg-brand-beige/80 backdrop-blur-md border-b border-brand-accent/10" id="app-header">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo / Name */}
          <a href="#home" className="flex items-center gap-3 group" id="logo-link">
            <span className="w-10 h-10 rounded-full border border-brand-accent flex items-center justify-center bg-brand-dark text-brand-beige font-serif font-bold text-sm transition-all duration-300 group-hover:bg-brand-accent group-hover:text-brand-dark">
              أف
            </span>
            <div className="flex flex-col">
              <span className="font-display font-bold text-base md:text-lg tracking-tight group-hover:text-brand-accent transition-colors">
                {portfolioData.name}
              </span>
              <span className="text-[10px] text-brand-muted font-sans font-medium tracking-wide">
                {portfolioData.title}
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" id="desktop-nav">
            <a href="#about" className="hover:text-brand-accent transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-brand-accent hover:after:w-full after:transition-all after:duration-300">عن الدكتور</a>
            <a href="#philosophy" className="hover:text-brand-accent transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-brand-accent hover:after:w-full after:transition-all after:duration-300">الرؤية والرسالة</a>
            <a href="#courses" className="hover:text-brand-accent transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-brand-accent hover:after:w-full after:transition-all after:duration-300">المقررات</a>
            <a href="#publications" className="hover:text-brand-accent transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-brand-accent hover:after:w-full after:transition-all after:duration-300">البحوث والمؤلفات</a>
            <a href="#contact" className="hover:text-brand-accent transition-colors relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-brand-accent hover:after:w-full after:transition-all after:duration-300">تواصل معي</a>
          </nav>

          {/* Action Button */}
          <div className="hidden md:block">
            <a 
              href="#contact" 
              className="px-5 py-2.5 rounded-none border border-brand-dark bg-brand-dark text-brand-beige text-xs font-semibold uppercase tracking-wider hover:bg-transparent hover:text-brand-dark transition-all duration-300 flex items-center gap-2"
              id="cta-nav-button"
            >
              طلب استشارة أكاديمية
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="md:hidden p-1.5 border border-brand-dark/20 text-brand-dark hover:border-brand-dark transition-colors"
            aria-label="Toggle Menu"
            id="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-3 top-20 bg-brand-beige border-b border-brand-accent/20 shadow-2xl z-20 md:hidden"
            id="mobile-menu"
          >
            <div className="p-6 flex flex-col gap-4 text-center font-medium border border-brand-accent/20">
              <a 
                href="#about" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 border-b border-brand-accent/5 hover:text-brand-accent transition-colors"
              >
                عن الدكتور
              </a>
              <a 
                href="#philosophy" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 border-b border-brand-accent/5 hover:text-brand-accent transition-colors"
              >
                الرؤية والرسالة
              </a>
              <a 
                href="#courses" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 border-b border-brand-accent/5 hover:text-brand-accent transition-colors"
              >
                المقررات الدراسية
              </a>
              <a 
                href="#publications" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 border-b border-brand-accent/5 hover:text-brand-accent transition-colors"
              >
                البحوث والمؤلفات
              </a>
              <a 
                href="#contact" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-brand-accent hover:underline"
              >
                تواصل معي
              </a>
              <a 
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 py-3 bg-brand-dark text-brand-beige text-xs font-semibold tracking-wider flex items-center justify-center gap-2 hover:bg-brand-accent hover:text-brand-dark transition-all"
              >
                طلب استشارة أكاديمية
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8" id="main-content">
        
        {/* HERO SECTION */}
        <section className="py-12 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="home">
          
          {/* Main Hero Text (Left side visually but RTL first on right) */}
          <div className="lg:col-span-8 space-y-8 lg:pr-6 order-2 lg:order-1">
            
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-accent/10 border border-brand-accent/20 rounded-full text-xs text-brand-accent font-semibold tracking-wider uppercase">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>كلية التربية الأساسية - الكويت</span>
              </div>
              
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-brand-dark leading-tight tracking-tight">
                رؤية معرفية <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-l from-brand-accent to-brand-dark/90 font-serif font-light italic">
                  تصنع تقنيات الغد التعليمي
                </span>
              </h1>
            </div>

            <p className="text-brand-muted text-base sm:text-lg md:text-xl font-normal leading-relaxed max-w-2xl">
              مرحباً بكم في الموقع الرسمي للبروفيسور المساعد <span className="font-semibold text-brand-dark">د. أحمد حسين الفيلكاوي</span>. 
              هنا تجتمع أصالة البحث التربوي مع طفرات الابتكار الرقمي والتصميم التعليمي، لنؤسس فضاءً أكاديمياً يتجاوز حدود الفصول التقليدية.
            </p>

            {/* Micro Stats / Labels */}
            <div className="grid grid-cols-3 gap-6 pt-4 border-t border-brand-accent/15 max-w-lg">
              <div className="space-y-1">
                <span className="block font-serif font-bold text-2xl text-brand-accent">٩</span>
                <span className="block text-xs text-brand-muted font-medium">كتب منشورة</span>
              </div>
              <div className="space-y-1">
                <span className="block font-serif font-bold text-2xl text-brand-accent">٢٠+</span>
                <span className="block text-xs text-brand-muted font-medium">بحثاً علمياً محكّماً</span>
              </div>
              <div className="space-y-1">
                <span className="block font-serif font-bold text-2xl text-brand-accent">٢٠٢٠</span>
                <span className="block text-xs text-brand-muted font-medium">أستاذ مشارك منذ</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <a 
                href="#courses" 
                className="px-8 py-3.5 bg-brand-dark text-brand-beige border border-brand-dark text-sm font-semibold tracking-wide hover:bg-transparent hover:text-brand-dark transition-all duration-300 text-center"
              >
                استكشف المقررات الدراسية
              </a>
              <a 
                href="#publications" 
                className="px-8 py-3.5 bg-transparent text-brand-dark border border-brand-dark/35 text-sm font-semibold tracking-wide hover:border-brand-dark hover:bg-brand-dark/5 transition-all duration-300 text-center flex items-center justify-center gap-2"
              >
                تصفح الكتب والأبحاث
                <BookOpen className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Hero Decorative Visual Box (Left side visually) */}
          <div className="lg:col-span-4 order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96" id="hero-graphic">
              {/* Outer delicate ring rotating */}
              <div className="absolute inset-0 border border-dashed border-brand-accent/40 rounded-full animate-spin [animation-duration:60s]" />
              
              {/* Inner floating box */}
              <div className="absolute inset-8 border border-brand-accent/20 bg-brand-beige/50 backdrop-blur-sm flex flex-col justify-between p-8 shadow-inner overflow-hidden">
                
                {/* Background ambient gold aura */}
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-brand-accent/20 rounded-full filter blur-xl pointer-events-none" />

                <div className="flex justify-between items-start z-10">
                  <span className="font-serif font-bold text-sm tracking-widest text-brand-accent/80">PAAET.EDU</span>
                  <Award className="w-6 h-6 text-brand-accent" />
                </div>
                
                <div className="space-y-4 z-10">
                  <div className="text-xs font-mono text-brand-accent tracking-widest uppercase">التصميم التعليمي الذكي</div>
                  <div className="font-serif text-2xl font-normal leading-snug">
                    "التعليم ليس ملء دلو، بل هو إيقاد شعلة."
                  </div>
                  <div className="text-xs text-brand-muted italic font-serif">ـ وليم بتلر ييتس</div>
                </div>

                <div className="flex justify-between items-end border-t border-brand-accent/15 pt-4 z-10">
                  <span className="text-[10px] text-brand-muted tracking-wider">قسم تكنولوجيا التعليم</span>
                  <span className="text-[10px] text-brand-muted font-serif">الكويت</span>
                </div>
              </div>

              {/* Decorative small boxes */}
              <div className="absolute -top-2 right-12 w-6 h-6 bg-brand-dark text-brand-beige flex items-center justify-center font-serif text-[10px] font-semibold border border-brand-accent">AI</div>
              <div className="absolute -bottom-2 left-16 w-6 h-6 bg-brand-accent/20 border border-brand-accent/50 rounded-full" />
            </div>
          </div>

        </section>

        {/* BIOGRAPHY / ABOUT SECTION */}
        <section className="py-16 md:py-24 border-t border-brand-accent/15" id="about">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Header & Subtitle */}
            <div className="lg:col-span-4 space-y-4">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-accent block font-semibold">الملف الأكاديمي</span>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-dark">السيرة والمسار المهني</h2>
              <p className="text-brand-muted text-sm sm:text-base leading-relaxed">
                مسيرة متواصلة من التحصيل والبحث الأكاديمي، بهدف قيادة تحول حقيقي في طرائق التدريس ومناهج تكنولوجيا التعليم في دولة الكويت والخليج العربي.
              </p>
              
              <div className="space-y-2 pt-4">
                <span className="block text-xs font-semibold uppercase text-brand-dark tracking-wider">مجالات الاهتمام والبحث:</span>
                <div className="flex flex-wrap gap-2">
                  {portfolioData.interests.map((interest, idx) => (
                    <span key={idx} className="bg-brand-dark/5 border border-brand-accent/10 px-3 py-1.5 text-xs text-brand-dark font-medium">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Detailed Bio & Academic Journey Timeline */}
            <div className="lg:col-span-8 space-y-12">
              
              {/* Bio summary paragraph */}
              <div className="p-8 border border-brand-accent/15 bg-white/45 relative shadow-sm">
                <div className="absolute -top-3 right-8 px-4 py-1 bg-brand-dark text-brand-beige text-xs font-semibold tracking-wide">الملخص المهني</div>
                <p className="text-brand-dark text-base sm:text-lg leading-relaxed pt-2">
                  {portfolioData.bio}
                </p>
              </div>

              {/* Interactive Journey Milestone Steps */}
              <div className="space-y-6">
                <h3 className="font-display font-bold text-lg text-brand-dark flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand-accent" />
                  محطات في مسيرتنا الأكاديمية
                </h3>
                
                <div className="relative border-r border-brand-accent/20 mr-4 space-y-8 pr-8">
                  {portfolioData.milestones.map((milestone, idx) => (
                    <div key={idx} className="relative group">
                      
                      {/* Timeline Node point */}
                      <span className="absolute -right-[41px] top-1.5 w-6.5 h-6.5 rounded-full border border-brand-accent bg-brand-beige flex items-center justify-center text-[10px] font-bold text-brand-accent group-hover:bg-brand-dark group-hover:text-brand-beige transition-colors duration-300">
                        {idx + 1}
                      </span>

                      <div className="space-y-1.5 p-5 border border-brand-accent/10 hover:border-brand-accent/45 bg-white/20 hover:bg-white/40 transition-all duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <span className="font-serif font-bold text-lg text-brand-accent tracking-wider">{milestone.year}</span>
                          <span className="text-[11px] text-brand-muted font-medium bg-brand-accent/5 px-2.5 py-0.5 border border-brand-accent/10">{milestone.institution}</span>
                        </div>
                        <h4 className="font-display font-bold text-brand-dark text-base">{milestone.title}</h4>
                        <p className="text-xs sm:text-sm text-brand-muted leading-relaxed font-normal">{milestone.description}</p>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* PHILOSOPHY & VALUES SECTION */}
        <section className="py-16 md:py-24 border-t border-brand-accent/15 bg-brand-dark text-brand-beige -mx-6 md:-mx-12 px-6 md:px-12" id="philosophy">
          <div className="max-w-7xl mx-auto space-y-12">
            
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-accent block font-semibold">فلسفة د. أحمد حسين الفيلكاوي</span>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-beige">الركائز التربوية والتعليمية</h2>
              <p className="text-gray-400 text-sm sm:text-base">
                نؤمن بأن تكنولوجيا التعليم ليست مجرد أدوات وشاشات، بل فلسفة متكاملة تهدف لإعادة صياغة تجربة الاكتشاف وصقل المهارات لحل مشكلات العالم الحقيقي.
              </p>
            </div>

            {/* Grid of Bento style cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {portfolioData.philosophies.map((phil, idx) => (
                <div 
                  key={idx} 
                  className="p-8 border border-brand-accent/20 bg-brand-dark/40 hover:border-brand-accent/60 transition-all duration-300 flex flex-col justify-between space-y-6 relative group overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-brand-accent/5 rounded-bl-full filter blur-md" />
                  
                  <div className="space-y-4">
                    <div className="w-12 h-12 border border-brand-accent/30 rounded-none bg-brand-dark/60 flex items-center justify-center group-hover:border-brand-accent transition-colors">
                      {renderPhilosophyIcon(phil.icon)}
                    </div>
                    <h3 className="font-display font-bold text-lg text-brand-beige tracking-tight group-hover:text-brand-accent transition-colors">{phil.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed font-light">{phil.desc}</p>
                  </div>

                  <div className="pt-4 border-t border-brand-accent/15 flex items-center justify-between text-[11px] text-brand-accent font-semibold tracking-wider">
                    <span>الركيزة رقم {idx + 1}</span>
                    <Clock className="w-3.5 h-3.5 text-brand-accent" />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border border-brand-accent/20 text-center max-w-lg mx-auto bg-brand-dark/60 text-xs tracking-wide">
              <span>"التعليم الجيد هو الذي يمنح الفرد القوة ليواصل التعلم بمفرده مدى الحياة."</span>
            </div>

          </div>
        </section>

        {/* ACADEMIC COURSES SECTION */}
        <section className="py-16 md:py-24 border-t border-brand-accent/15" id="courses">
          <div className="space-y-12">
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4">
                <span className="font-mono text-xs uppercase tracking-widest text-brand-accent block font-semibold">المقررات الدراسية</span>
                <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-dark">التدريس والمقررات الجامعية</h2>
                <p className="text-brand-muted text-sm sm:text-base max-w-xl">
                  مقررات مصممة بعناية لبناء الكفايات التربوية والمهارات التكنولوجية لدى الطلبة في قسم تكنولوجيا التعليم بكلية التربية الأساسية.
                </p>
              </div>

              {/* Decorative note */}
              <div className="text-xs font-serif italic text-brand-accent text-left bg-brand-accent/5 px-4 py-2 border border-brand-accent/10">
                انقر على أي مقرر لمطالعة أهدافه التعليمية وتفاصيله
              </div>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {portfolioData.courses.map((course) => (
                <div 
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className="p-8 border border-brand-accent/15 bg-white/30 hover:border-brand-accent hover:bg-white/70 transition-all duration-300 cursor-pointer group flex flex-col justify-between gap-6 shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      {course.code && <span className="font-serif font-bold text-xs tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 border border-brand-accent/15">{course.code}</span>}
                      <span className="text-[11px] text-brand-muted font-medium font-serif">{course.level}</span>
                    </div>
                    
                    <h3 className="font-display font-bold text-lg md:text-xl text-brand-dark group-hover:text-brand-accent transition-colors">
                      {course.title}
                    </h3>
                    
                    <p className="text-sm text-brand-muted leading-relaxed font-normal">
                      {course.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-brand-accent/10 flex items-center justify-between text-xs font-semibold text-brand-accent">
                    <span>تفاصيل المنهج والأهداف</span>
                    <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* COURSE DETAILS MODAL / DRAWER */}
        <AnimatePresence>
          {selectedCourse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-sm" id="course-modal">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-brand-beige border border-brand-accent max-w-2xl w-full p-8 md:p-10 shadow-2xl relative overflow-y-auto max-h-[85vh]"
              >
                {/* Close Button */}
                <button 
                  onClick={() => setSelectedCourse(null)}
                  className="absolute top-4 left-4 p-2 border border-brand-dark/10 hover:border-brand-dark text-brand-dark hover:text-brand-accent transition-colors"
                  aria-label="Close details"
                  id="close-modal-btn"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="space-y-4 pb-6 border-b border-brand-accent/20">
                  <div className="flex items-center gap-3">
                    {selectedCourse.code && <span className="font-serif font-bold text-xs bg-brand-dark text-brand-beige px-3 py-1 border border-brand-accent">{selectedCourse.code}</span>}
                    <span className="text-[11px] text-brand-accent font-semibold">{selectedCourse.level}</span>
                  </div>
                  <h3 className="font-display font-extrabold text-2xl md:text-3xl text-brand-dark">{selectedCourse.title}</h3>
                  <p className="text-brand-muted text-sm sm:text-base leading-relaxed">{selectedCourse.description}</p>
                </div>

                {/* Modal Content - Objectives */}
                <div className="py-6 space-y-4">
                  <h4 className="font-display font-bold text-sm text-brand-dark tracking-wider uppercase flex items-center gap-2">
                    <Book className="w-4.5 h-4.5 text-brand-accent" />
                    مخرجات وأهداف المقرر التدريسية:
                  </h4>
                  <ul className="space-y-3">
                    {selectedCourse.objectives.map((obj, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-brand-dark/90 leading-relaxed bg-brand-accent/5 p-3.5 border-r-2 border-brand-accent">
                        <span className="font-serif font-bold text-brand-accent text-xs pt-0.5">{index + 1}.</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-brand-accent/15 flex justify-end">
                  <button 
                    onClick={() => setSelectedCourse(null)}
                    className="px-6 py-2.5 bg-brand-dark text-brand-beige text-xs font-semibold hover:bg-brand-accent hover:text-brand-dark transition-all duration-300"
                  >
                    إغلاق التفاصيل
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* RESEARCH & PUBLICATIONS SECTION */}
        <section className="py-16 md:py-24 border-t border-brand-accent/15" id="publications">
          <div className="space-y-12">
            
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="font-mono text-xs uppercase tracking-widest text-brand-accent block font-semibold">المؤلفات العلمية</span>
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-brand-dark">الكتب والبحوث الأكاديمية المنشورة</h2>
              <p className="text-brand-muted text-sm sm:text-base">
                نتاج علمي يوثق الدراسات الميدانية والتجريبية والمناهج المرجعية المصممة لتطوير واقع التعليم الرقمي وتطبيقاته العملية.
              </p>
            </div>

            {/* Filter and Search controls */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 p-4 bg-white/20 border border-brand-accent/10">
              
              {/* Type Tabs */}
              <div className="flex items-center gap-2 border-b md:border-b-0 border-brand-accent/10 pb-4 md:pb-0">
                <button 
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${activeTab === 'all' ? 'bg-brand-dark text-brand-beige' : 'hover:bg-brand-dark/5 text-brand-dark'}`}
                >
                  الكل ({portfolioData.publications.length})
                </button>
                <button 
                  onClick={() => setActiveTab('book')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${activeTab === 'book' ? 'bg-brand-dark text-brand-beige' : 'hover:bg-brand-dark/5 text-brand-dark'}`}
                >
                  الكتب ({portfolioData.publications.filter(p => p.type === 'book').length})
                </button>
                <button 
                  onClick={() => setActiveTab('paper')}
                  className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${activeTab === 'paper' ? 'bg-brand-dark text-brand-beige' : 'hover:bg-brand-dark/5 text-brand-dark'}`}
                >
                  البحوث المحكمة ({portfolioData.publications.filter(p => p.type === 'paper').length})
                </button>
              </div>

              {/* Keyword Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input 
                  type="text" 
                  placeholder="ابحث بالكلمات المفتاحية أو العنوان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-brand-beige border border-brand-accent/20 text-xs text-brand-dark focus:border-brand-accent focus:outline-none placeholder:text-brand-muted/70 transition-all"
                  id="pub-search-input"
                />
              </div>

            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <AnimatePresence mode="popLayout">
                {filteredPublications.map((pub) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    key={pub.id}
                    className="p-6 border border-brand-accent/15 bg-white/40 hover:border-brand-accent hover:bg-white/70 transition-all duration-300 flex flex-col justify-between space-y-6 relative group shadow-sm"
                  >
                    
                    {/* Glowing type line indicator */}
                    <div className={`absolute top-0 right-0 left-0 h-1.5 ${pub.type === 'book' ? 'bg-brand-accent' : 'bg-brand-dark'}`} />

                    <div className="space-y-4">
                      
                      {/* Publisher and Year */}
                      <div className="flex items-center justify-between text-[11px] text-brand-muted font-medium pt-1">
                        <span className="flex items-center gap-1.5">
                          {pub.type === 'book' ? <Book className="w-3.5 h-3.5 text-brand-accent" /> : <FileText className="w-3.5 h-3.5 text-brand-dark" />}
                          {pub.publisher}
                        </span>
                        {pub.year && <span className="font-serif font-bold text-brand-accent">{pub.year}</span>}
                      </div>

                      {/* Title */}
                      <h3 className="font-display font-bold text-base text-brand-dark group-hover:text-brand-accent transition-colors leading-snug">
                        {pub.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-brand-muted leading-relaxed font-normal line-clamp-3">
                        {pub.description}
                      </p>

                    </div>

                    {/* Metadata tags & Arrow link */}
                    <div className="pt-4 border-t border-brand-accent/10 flex flex-col gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {pub.tags.map((tag, idx) => (
                          <span key={idx} className="text-[10px] bg-brand-accent/5 border border-brand-accent/10 px-2 py-0.5 text-brand-dark font-medium">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] font-semibold text-brand-accent">
                        <span>
                          {pub.type === 'book' ? 'معلومات الكتاب والمكتبة' : 'قراءة البحث والملخص'}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>

                  </motion.div>
                ))}
              </AnimatePresence>

              {/* No results message */}
              {filteredPublications.length === 0 && (
                <div className="col-span-full py-16 text-center border border-dashed border-brand-accent/30 space-y-4 bg-brand-accent/5">
                  <FileText className="w-10 h-10 text-brand-muted/50 mx-auto" />
                  <p className="text-sm font-medium text-brand-muted">لا توجد كتب أو أبحاث تطابق عبارات البحث المكتوبة.</p>
                  <button 
                    onClick={() => { setSearchQuery(''); setActiveTab('all'); }} 
                    className="px-4 py-2 bg-brand-dark text-brand-beige text-xs font-semibold"
                  >
                    عرض جميع المؤلفات
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* CONTACT / FEEDBACK & ACADEMIC INQUIRIES */}
        <section className="py-16 md:py-24 border-t border-brand-accent/15" id="contact">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 bg-white/45 border border-brand-accent/15 p-8 md:p-12 shadow-sm">
            
            {/* Contact Info (Left Side RTL) */}
            <div className="lg:col-span-5 space-y-8 lg:border-l lg:border-brand-accent/15 lg:pl-12">
              <div className="space-y-4">
                <span className="font-mono text-xs uppercase tracking-widest text-brand-accent block font-semibold">تواصل مباشر</span>
                <h2 className="font-display font-extrabold text-3xl text-brand-dark">التواصل الأكاديمي والمهني</h2>
                <p className="text-brand-muted text-sm sm:text-base leading-relaxed">
                  نرحب بجميع تساؤلات واستشارات الزملاء الباحثين، المعلمين، والطلبة الأعزاء في شأن التعاون العلمي وتكنولوجيا التعليم الفعال.
                </p>
              </div>

              {/* Physical details list */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full border border-brand-accent/20 bg-brand-accent/5 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-brand-accent font-mono uppercase">المكتب والمقر</span>
                    <span className="block text-sm text-brand-dark font-medium leading-relaxed">
                      قسم تكنولوجيا التعليم - كلية التربية الأساسية (العارضية الصناعية) - مبنى المعلمين - دولة الكويت
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full border border-brand-accent/20 bg-brand-accent/5 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-xs font-semibold text-brand-accent font-mono uppercase">البريد الإلكتروني الرسمي</span>
                    <a href="#" className="block text-sm text-brand-dark font-semibold hover:text-brand-accent transition-colors font-serif">
                      «أضف بريدك الرسمي»
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Channels in Kuwait */}
              <div className="space-y-3 pt-4">
                <span className="block text-xs font-semibold text-brand-dark uppercase tracking-wider">المنصات والأكاديميات المهنية:</span>
                <div className="flex flex-wrap gap-3">
                  {portfolioData.socials.map((social, idx) => (
                    <a 
                      key={idx} 
                      href={social.url} 
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      className="px-4 py-2 border border-brand-accent/25 hover:border-brand-dark text-xs text-brand-dark font-semibold transition-all duration-300 bg-brand-beige/50 hover:bg-brand-dark hover:text-brand-beige flex items-center gap-1.5"
                    >
                      {social.label}
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Feed back submission Form (Right Side RTL) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="space-y-2">
                <h3 className="font-display font-bold text-xl text-brand-dark">أرسل استفسارك الأكاديمي</h3>
                <p className="text-brand-muted text-xs sm:text-sm">
                  يرجى ملء النموذج أدناه بدقة وسيقوم الدكتور أو فريقه الأكاديمي بالرد عليك في أقرب وقت.
                </p>
              </div>

              {/* Animated form box */}
              <div className="relative min-h-[350px]">
                <AnimatePresence mode="wait">
                  {!formSubmitted ? (
                    <motion.form 
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleContactSubmit} 
                      className="space-y-5"
                      id="academic-contact-form"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        
                        {/* Name input */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-brand-dark" htmlFor="input-name">الاسم الكامل *</label>
                          <input 
                            type="text" 
                            id="input-name"
                            required
                            placeholder="الاسم الثلاثي..."
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-4 py-2.5 bg-brand-beige border border-brand-accent/20 focus:border-brand-accent focus:outline-none text-xs text-brand-dark placeholder:text-brand-muted/50 transition-all"
                          />
                        </div>

                        {/* Email input */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-brand-dark" htmlFor="input-email">البريد الإلكتروني *</label>
                          <input 
                            type="email" 
                            id="input-email"
                            required
                            placeholder="name@domain.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full px-4 py-2.5 bg-brand-beige border border-brand-accent/20 focus:border-brand-accent focus:outline-none text-xs text-brand-dark placeholder:text-brand-muted/50 transition-all font-serif"
                          />
                        </div>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        
                        {/* Role Selector */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-brand-dark" htmlFor="input-role">الصفة أو الحالة</label>
                          <select 
                            id="input-role"
                            value={formData.role}
                            onChange={(e) => setFormData({...formData, role: e.target.value})}
                            className="w-full px-4 py-2.5 bg-brand-beige border border-brand-accent/20 focus:border-brand-accent focus:outline-none text-xs text-brand-dark transition-all appearance-none"
                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b7355\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'left 12px center', backgroundSize: '16px' }}
                          >
                            <option value="student">طالب / طالبة بكلية التربية</option>
                            <option value="researcher">باحث / باحثة أكاديمية</option>
                            <option value="teacher">معلم / معلمة بالوزارة</option>
                            <option value="other">شخصية مهتمة أخرى</option>
                          </select>
                        </div>

                        {/* Subject input */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-brand-dark" htmlFor="input-subject">موضوع الاستفسار</label>
                          <input 
                            type="text" 
                            id="input-subject"
                            placeholder="الموضوع الأكاديمي..."
                            value={formData.subject}
                            onChange={(e) => setFormData({...formData, subject: e.target.value})}
                            className="w-full px-4 py-2.5 bg-brand-beige border border-brand-accent/20 focus:border-brand-accent focus:outline-none text-xs text-brand-dark placeholder:text-brand-muted/50 transition-all"
                          />
                        </div>

                      </div>

                      {/* Message body */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-brand-dark" htmlFor="input-message">تفاصيل الرسالة *</label>
                        <textarea 
                          id="input-message"
                          required
                          rows={4}
                          placeholder="اكتب رسالتك أو استفسارك بوضوح هنا..."
                          value={formData.message}
                          onChange={(e) => setFormData({...formData, message: e.target.value})}
                          className="w-full px-4 py-2.5 bg-brand-beige border border-brand-accent/20 focus:border-brand-accent focus:outline-none text-xs text-brand-dark placeholder:text-brand-muted/50 transition-all resize-none"
                        />
                      </div>

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button 
                          type="submit"
                          disabled={formSubmitting}
                          className="w-full sm:w-auto px-8 py-3 bg-brand-dark text-brand-beige border border-brand-dark text-xs font-semibold uppercase tracking-wider hover:bg-transparent hover:text-brand-dark transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          {formSubmitting ? (
                            <>
                              <span>جاري إرسال الرسالة...</span>
                              <div className="w-4 h-4 border-2 border-brand-beige border-t-transparent rounded-full animate-spin" />
                            </>
                          ) : (
                            <>
                              <span>إرسال الاستفسار الأكاديمي</span>
                              <Send className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>

                    </motion.form>
                  ) : (
                    <motion.div 
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-8 border border-brand-accent/30 bg-brand-accent/5 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]"
                      id="form-success-alert"
                    >
                      <CheckCircle className="w-12 h-12 text-brand-accent animate-pulse" />
                      <h4 className="font-display font-bold text-lg text-brand-dark">تم استلام استفسارك بنجاح</h4>
                      <p className="text-sm text-brand-muted max-w-md leading-relaxed">
                        شكراً لتواصلك الأكاديمي الموقر، تم توجيه رسالتك إلى قسم المراجعة وسنقوم بالرد عليكم عبر البريد الإلكتروني الذي أدخلته قريباً جداً.
                      </p>
                      <button 
                        onClick={() => setFormSubmitted(false)}
                        className="px-6 py-2.5 bg-brand-dark text-brand-beige text-xs font-semibold hover:bg-brand-accent hover:text-brand-dark transition-all duration-300"
                      >
                        إرسال رسالة جديدة
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="mt-16 bg-brand-dark text-brand-beige border-t border-brand-accent/20 px-6 py-12 mx-3 md:mx-6 mb-3" id="app-footer">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-brand-accent/15 pb-8">
          
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full border border-brand-accent flex items-center justify-center bg-brand-beige text-brand-dark font-serif font-bold text-xs">
                أف
              </span>
              <span className="font-display font-extrabold text-lg text-brand-beige">{portfolioData.name}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-md font-light">
              موقع مكرس للتواصل والابتكار وتصميم بيئات التعلم الرقمية الذكية بإشراف د. أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم المشارك بكلية التربية الأساسية بدولة الكويت.
            </p>
          </div>

          <div className="md:col-span-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-6 text-xs text-gray-400">
            <a href="#about" className="hover:text-brand-accent transition-colors">عن الدكتور</a>
            <a href="#philosophy" className="hover:text-brand-accent transition-colors">الفلسفة الأكاديمية</a>
            <a href="#courses" className="hover:text-brand-accent transition-colors">المقررات</a>
            <a href="#publications" className="hover:text-brand-accent transition-colors">المؤلفات والبحوث</a>
            <a href="#contact" className="hover:text-brand-accent transition-colors">تواصل مباشر</a>
          </div>

        </div>

        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500 font-serif">
          <span>
            &copy; {new Date().getFullYear()} {portfolioData.name}. جميع الحقوق محفوظة.
          </span>
          <span className="flex items-center gap-1 leading-none text-[10px]">
            تكنولوجيا التعليم <span className="text-brand-accent">●</span> كلية التربية الأساسية <span className="text-brand-accent">●</span> دولة الكويت
          </span>
        </div>
      </footer>

    </div>
  );
}
