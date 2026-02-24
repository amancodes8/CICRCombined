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

  return <p>{status}</p>;
}
