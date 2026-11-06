import { useState, useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';
import { Trans, useLingui } from '@lingui/react/macro';

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(username: string, password: string, remember: boolean) => Promise<void>} props.onUpload Rejects to keep the modal open.
 * @param {boolean} [props.isUploading]
 * @param {Pick<import('../types').Shot, 'profile' | 'timestamp' | 'duration' | 'volume'>} [props.shotInfo]
 */
export default function VisualizerUploadModal({
  isOpen,
  onClose,
  onUpload,
  isUploading = false,
  shotInfo,
}) {
  const { t } = useLingui();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(false);

  /** @param {import('preact').JSX.TargetedEvent<HTMLFormElement, Event>} e */
  const handleSubmit = async e => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert(t`Please enter both username and password`);
      return;
    }

    try {
      await onUpload(username.trim(), password, rememberCredentials);

      // Only the username is remembered; the password would sit in plain text in localStorage.
      try {
        if (rememberCredentials) {
          localStorage.setItem('visualizer_username', username.trim());
          localStorage.setItem('visualizer_remember', 'true');
        } else {
          localStorage.removeItem('visualizer_username');
          localStorage.removeItem('visualizer_remember');
        }
      } catch (error) {
        console.warn('Failed to store Visualizer username:', error);
      }

      // Clear form and close modal on success
      setUsername('');
      setPassword('');
      onClose();
    } catch (error) {
      // Error handling is done in parent component
      console.error('Upload failed:', error);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setUsername('');
      setPassword('');
      onClose();
    }
  };

  // Load the saved username when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      // Older versions also stored the password; drop it.
      localStorage.removeItem('visualizer_password');
      const savedUsername = localStorage.getItem('visualizer_username');
      const savedRemember = localStorage.getItem('visualizer_remember') === 'true';
      if (savedRemember && savedUsername) {
        setUsername(savedUsername);
        setRememberCredentials(true);
      }
    } catch (error) {
      console.warn('Failed to read Visualizer username:', error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
      <div className='bg-base-100 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg shadow-xl'>
        <div className='p-6'>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>
              <Trans>Upload to Visualizer.coffee</Trans>
            </h3>
            {!isUploading && (
              <button
                onClick={handleClose}
                className='text-base-content/60 hover:text-base-content'
                aria-label={t`Close`}
              >
                ✕
              </button>
            )}
          </div>

          {shotInfo && (
            <div className='bg-base-200 mb-4 rounded-md p-3'>
              <p className='text-base-content/80 text-sm'>
                <strong>
                  <Trans>Shot:</Trans>
                </strong>{' '}
                {shotInfo.profile}
              </p>
              <p className='text-base-content/80 text-sm'>
                <strong>
                  <Trans>Date:</Trans>
                </strong>{' '}
                {new Date(shotInfo.timestamp * 1000).toLocaleString()}
              </p>
              <p className='text-base-content/80 text-sm'>
                <strong>
                  <Trans>Duration:</Trans>
                </strong>{' '}
                {(shotInfo.duration / 1000).toFixed(1)}s
              </p>
              {shotInfo.volume != null && shotInfo.volume > 0 && (
                <p className='text-base-content/80 text-sm'>
                  <strong>
                    <Trans>Yield:</Trans>
                  </strong>{' '}
                  {shotInfo.volume}g
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-4' name='visualizer-login' method='post'>
            <div>
              <label htmlFor='username' className='mb-1 block text-sm font-medium'>
                <Trans>Visualizer.coffee Username</Trans>
              </label>
              <input
                id='username'
                name='username'
                type='text'
                value={username}
                onChange={e => setUsername(e.currentTarget.value)}
                disabled={isUploading}
                className='input w-full'
                placeholder={t`Enter your username`}
                autoComplete='username'
                required
              />
            </div>

            <div>
              <label htmlFor='password' className='mb-1 block text-sm font-medium'>
                <Trans>Password</Trans>
              </label>
              <div className='relative'>
                <input
                  id='password'
                  name='password'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.currentTarget.value)}
                  disabled={isUploading}
                  className='input w-full pr-10'
                  placeholder={t`Enter your password`}
                  autoComplete='current-password'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isUploading}
                  className='text-base-content/50 hover:text-base-content absolute inset-y-0 right-0 z-10 flex items-center pr-3 disabled:opacity-50'
                  aria-label={showPassword ? t`Hide password` : t`Show password`}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </div>

            <div className='flex items-center'>
              <input
                id='remember'
                type='checkbox'
                checked={rememberCredentials}
                onChange={e => setRememberCredentials(e.currentTarget.checked)}
                disabled={isUploading}
                className='checkbox checkbox-sm checkbox-primary'
              />
              <label htmlFor='remember' className='text-base-content/80 ml-2 text-sm'>
                <Trans>Remember credentials</Trans>
              </label>
            </div>

            <div className='flex justify-end space-x-3 pt-4'>
              <button
                type='button'
                onClick={handleClose}
                disabled={isUploading}
                className='btn btn-ghost'
              >
                <Trans>Cancel</Trans>
              </button>
              <button
                type='submit'
                disabled={isUploading || !username.trim() || !password.trim()}
                className='btn btn-primary'
              >
                {isUploading && <FontAwesomeIcon icon={faSpinner} spin />}
                <span>{isUploading ? t`Uploading...` : t`Upload Shot`}</span>
              </button>
            </div>
          </form>

          <div className='text-base-content/60 mt-4 text-xs'>
            <p>
              <Trans>
                Your credentials are only used for this upload and will be stored locally only if
                you choose to remember your username.
              </Trans>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
