import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import apiClient from '../../api/client';
import Modal from '../common/Modal';
import Badge from '../common/Badge';

const ExcelUploadModal = ({ isOpen, onClose, onComplete, departments }) => {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, result

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData(null);
      setImportResult(null);
      setStep('upload');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use axios directly for FormData
      const response = await fetch('/api/admin/employees/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });
      const res = await response.json();

      if (res.success) {
        setParsedData(res.data);
        setStep('preview');
      } else {
        alert(res.error || '파일 업로드에 실패했습니다.');
      }
    } catch (err) {
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData?.rows) return;
    setImporting(true);
    try {
      const res = await apiClient.post('/admin/employees/bulk', {
        employees: parsedData.rows,
      });
      if (res.success) {
        setImportResult(res.data);
        setStep('result');
      }
    } catch (err) {
      alert(err.error || '일괄 등록에 실패했습니다.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setImportResult(null);
    setStep('upload');
    if (step === 'result' && importResult?.success > 0) {
      onComplete();
    } else {
      onClose();
    }
  };

  const renderUploadStep = () => (
    <div>
      <div
        style={{
          border: '2px dashed var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color var(--transition-fast)',
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.style.borderColor = 'var(--color-border)';
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile) {
            setFile(droppedFile);
            if (fileInputRef.current) fileInputRef.current.files = e.dataTransfer.files;
          }
        }}
      >
        <Upload size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }} />
        <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
          클릭하거나 파일을 드래그하여 업로드
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          .xlsx, .xls 파일만 지원 (최대 10MB)
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {file && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px',
          padding: '8px 12px', background: 'var(--color-bg-table-header)', borderRadius: 'var(--radius-md)',
        }}>
          <FileSpreadsheet size={16} style={{ color: 'var(--color-success)' }} />
          <span style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>{file.name}</span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {(file.size / 1024).toFixed(1)} KB
          </span>
        </div>
      )}

      <div style={{
        marginTop: '16px', padding: '10px 12px', background: 'var(--color-info-light)',
        borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-info)',
      }}>
        <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: '4px' }}>엑셀 파일 형식</div>
        <div>열 순서: 사번, 이름, 부서명, 직위, 역할, 입사일, 생년월일, 성별(M/F), 연락처, 고용형태(regular/contract)</div>
        <div style={{ marginTop: '2px' }}>첫 번째 행은 헤더로 무시됩니다.</div>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div>
      <div style={{ marginBottom: '12px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        총 {parsedData?.total || 0}건이 파싱되었습니다.
        {parsedData?.errors?.length > 0 && (
          <span style={{ color: 'var(--color-danger)', marginLeft: '8px' }}>
            {parsedData.errors.length}건 오류 발견
          </span>
        )}
      </div>

      {parsedData?.errors?.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {parsedData.errors.map((err, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
              background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)', marginBottom: '4px',
            }}>
              <AlertCircle size={14} /> {err.row}행: {err.error}
            </div>
          ))}
        </div>
      )}

      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>행</th>
                <th>사번</th>
                <th>이름</th>
                <th>부서</th>
                <th>직위</th>
                <th>역할</th>
                <th>입사일</th>
                <th>성별</th>
              </tr>
            </thead>
            <tbody>
              {parsedData?.rows?.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{row.row_number}</td>
                  <td>{row.employee_number}</td>
                  <td>{row.name}</td>
                  <td>{row.department_name}</td>
                  <td>{row.position}</td>
                  <td>{row.role}</td>
                  <td>{row.hire_date}</td>
                  <td>{row.gender}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderResultStep = () => (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      {importResult?.success > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <CheckCircle size={48} style={{ color: 'var(--color-success)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '4px' }}>
            {importResult.success}명 등록 완료
          </div>
        </div>
      )}
      {importResult?.failed > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <Badge variant="danger">{importResult.failed}명 등록 실패</Badge>
        </div>
      )}
      {importResult?.errors?.length > 0 && (
        <div style={{ textAlign: 'left', maxHeight: '200px', overflow: 'auto' }}>
          {importResult.errors.map((err, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
              background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)', marginBottom: '4px',
            }}>
              <AlertCircle size={14} /> {err.employee_number}: {err.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getFooter = () => {
    if (step === 'upload') {
      return (
        <>
          <button className="btn btn--secondary" onClick={handleClose}>취소</button>
          <button className="btn btn--primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? '업로드 중...' : '업로드 및 미리보기'}
          </button>
        </>
      );
    }
    if (step === 'preview') {
      return (
        <>
          <button className="btn btn--secondary" onClick={() => setStep('upload')}>이전</button>
          <button className="btn btn--primary" onClick={handleImport} disabled={importing || !parsedData?.rows?.length}>
            {importing ? '등록 중...' : `${parsedData?.rows?.length || 0}명 일괄 등록`}
          </button>
        </>
      );
    }
    return (
      <button className="btn btn--primary" onClick={handleClose}>완료</button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="엑셀 일괄 등록" size="lg" footer={getFooter()}>
      {step === 'upload' && renderUploadStep()}
      {step === 'preview' && renderPreviewStep()}
      {step === 'result' && renderResultStep()}
    </Modal>
  );
};

export default ExcelUploadModal;
