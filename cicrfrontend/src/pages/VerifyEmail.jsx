import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api';

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Verifying email...');

  useEffect(() => {
    const run = async () => {
      try {
        await verifyEmail(token);
        setStatus('Email verified. Redirecting to login...');
        setTimeout(() => navigate('/login'), 1000);
      } catch (err) {
        setStatus(err.response?.data?.message || 'Verification failed. Please request a new verification email.');
      }
    };
    run();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 page-motion-b">
      <div className="w-full max-w-lg border border-gray-800 rounded-3xl p-8 section-motion section-motion-delay-1">
        <p className="text-[10px] uppercase tracking-[0.24em] text-blue-400 font-black">Email Verification</p>
        <p className="text-gray-200 mt-3">{status}</p>
      </div>
    </div>
  );
}
