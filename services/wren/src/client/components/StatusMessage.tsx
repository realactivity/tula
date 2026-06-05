interface Props {
  status: 'loading' | 'success' | 'error' | 'info';
  message: string;
}

export default function StatusMessage({ status, message }: Props) {
  if (!message) return null;

  return (
    <div className={`status status-${status}`}>
      {status === 'loading' && <span className="spinner" />}
      {status === 'success' && '✅ '}
      {status === 'error' && '❌ '}
      {message}
    </div>
  );
}
