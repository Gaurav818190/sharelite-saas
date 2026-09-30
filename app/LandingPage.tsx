"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const stats = [
  { icon: "<", value: 120, suffix: "ms", label: "Inference Time" },
  { icon: "%", value: 99.99, suffix: "%", label: "Platform Uptime" },
  { icon: "*", value: 24, suffix: "/7", label: "Autonomous Runtime" },
  { icon: "#", value: 2.4, suffix: "M", label: "Context Windows" },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [countsStarted, setCountsStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statsRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCountsStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(statsRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 720) setMenuOpen(false);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <main className="sharelite-landing">
      {/* Background video */}
      <div className="sharelite-video-bg">
        <video
          className="sharelite-bg-video"
          autoPlay
          muted
          loop
          playsInline
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>

        <div className="sharelite-video-overlay" />
      </div>

      {/* Header */}
      <header className="sharelite-header">
        <Link href="/" className="sharelite-brand">
          <span className="sharelite-brand-mark">S</span>
          <span>
            Share<span>Lite</span>
          </span>
        </Link>

        <nav className="sharelite-desktop-nav">
          <Link className="active" href="/">
            Home
          </Link>
          <Link href="#product">Product</Link>
          <Link href="#features">Features</Link>
          <Link href="#contact">Contact</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/plans"
            className="sharelite-upgrade"
          >
            Upgrade
          </Link>

          <Link
            href="/login"
            className="sharelite-login desktop-login"
          >
            Login
          </Link>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className={`sharelite-menu-button ${
            menuOpen ? "is-open" : ""
          }`}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="sharelite-mobile-overlay"
            onClick={() => setMenuOpen(false)}
          />

          <nav className="sharelite-mobile-menu">
            <Link href="/" onClick={() => setMenuOpen(false)}>
              Home
            </Link>

            <Link
              href="#product"
              onClick={() => setMenuOpen(false)}
            >
              Product
            </Link>

            <Link
              href="#features"
              onClick={() => setMenuOpen(false)}
            >
              Features
            </Link>

            <Link
              href="#contact"
              onClick={() => setMenuOpen(false)}
            >
              Contact
            </Link>

            <Link
              href="/plans"
              className="sharelite-mobile-upgrade"
              onClick={() => setMenuOpen(false)}
            >
              Upgrade
            </Link>

            <Link
              href="/login"
              className="sharelite-mobile-login"
              onClick={() => setMenuOpen(false)}
            >
              Login
            </Link>
          </nav>
        </>
      )}

      {/* Hero */}
      <section className="sharelite-hero" id="product">
        <div className="sharelite-trust reveal reveal-delay-1">
          <div className="sharelite-avatar">
            <span>AI</span>
          </div>

          <div className="sharelite-avatar avatar-overlap">
            <span>✦</span>
          </div>

          <div className="sharelite-avatar avatar-overlap">
            <span>SL</span>
          </div>

          <div className="sharelite-trust-pill">
            Built for modern business outreach
          </div>
        </div>

        <div className="sharelite-hero-copy">
          <h1 className="sharelite-headline">
            <span className="headline-line reveal reveal-delay-2">
              Intelligence
            </span>

            <span className="headline-line reveal reveal-delay-3">
              Designed To Evolve
            </span>
          </h1>

          <p className="sharelite-subhead reveal reveal-delay-4">
            AI-powered outreach made simple. Find leads, validate emails,
            create better messages and grow your business from one powerful
            workspace.
          </p>

          <div className="sharelite-actions reveal reveal-delay-5">
            <Link href="/signup" className="sharelite-cta">
              Get Started Free
            </Link>

            <span className="sharelite-trial">
              12-day free trial
            </span>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section
        className="sharelite-feature-strip"
        id="features"
        aria-label="ShareLite features"
      >
        <div>
          <strong>AI Outreach</strong>
          <span>Better messages</span>
        </div>

        <div>
          <strong>Lead Intelligence</strong>
          <span>Organize prospects</span>
        </div>

        <div>
          <strong>Email Validation</strong>
          <span>Reach real inboxes</span>
        </div>
      </section>

      {/* Stats */}
      <footer className="sharelite-stats" ref={statsRef}>
        {stats.map((stat, index) => (
          <Stat
            key={stat.label}
            {...stat}
            index={index}
            started={countsStarted}
          />
        ))}
      </footer>

      <div id="contact" className="sharelite-contact-anchor" />
    </main>
  );
}

type StatProps = {
  icon: string;
  value: number;
  suffix: string;
  label: string;
  index: number;
  started: boolean;
};

function Stat({
  icon,
  value,
  suffix,
  label,
  index,
  started,
}: StatProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!started) return;

    const duration = 1500 + index * 80;
    const delay = 480 + index * 90;

    let frame = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    timeout = setTimeout(() => {
      const start = performance.now();

      const animate = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        setCurrent(value * eased);

        if (progress < 1) {
          frame = requestAnimationFrame(animate);
        }
      };

      frame = requestAnimationFrame(animate);
    }, delay);

    return () => {
      if (timeout) clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [started, value, index]);

  const decimals =
    value % 1 !== 0 ? 1 : value === 99.99 ? 2 : 0;

  return (
    <div
      className="sharelite-stat reveal"
      style={{
        animationDelay: `${0.5 + index * 0.08}s`,
      }}
    >
      <div className="sharelite-stat-top">
        <span className="sharelite-stat-icon">{icon}</span>

        <span className="sharelite-stat-value">
          {current.toFixed(decimals)}
        </span>

        <span className="sharelite-stat-suffix">{suffix}</span>
      </div>

      <span className="sharelite-stat-label">{label}</span>
    </div>
  );
}