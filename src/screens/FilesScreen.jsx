import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    TextInput, Modal, Alert, ActivityIndicator, Image,
    Linking, FlatList, Platform, Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
    browseFolder, createFolder as apiCreateFolder,
    updateFolder as apiUpdateFolder, deleteFolder as apiDeleteFolder,
    getFolderTree,
} from '../service/folder';
import {
    uploadFile as apiUploadFile,
    updateFile as apiUpdateFile,
    deleteFile as apiDeleteFile,
} from '../service/files';
import { BASE_URL } from '../service/api';
import storage from '../service/storage';
import PageLoader from '../components/PageLoader';
import CustomAlertModal from '../components/CustomAlertModal';

const fmtSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getPdfHtml = (base64) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      color: #94a3b8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    #canvas-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
      box-sizing: border-box;
    }
    canvas {
      width: 96% !important;
      height: auto !important;
      margin: 8px 0;
      background-color: #ffffff;
      border-radius: 6px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
    }
    #status-msg {
      margin-top: 40px;
      font-size: 14px;
      font-weight: 500;
      color: #94a3b8;
      text-align: center;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
</head>
<body>
  <div id="status-msg">Preparing PDF preview...</div>
  <div id="canvas-container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
    (async function() {
      const statusEl = document.getElementById('status-msg');
      try {
        const base64Data = "${base64}";
        const raw = window.atob(base64Data);
        const rawLength = raw.length;
        const array = new Uint8Array(new ArrayBuffer(rawLength));
        for(let i = 0; i < rawLength; i++) {
          array[i] = raw.charCodeAt(i);
        }
        
        const loadingTask = pdfjsLib.getDocument({ data: array });
        const pdf = await loadingTask.promise;
        statusEl.style.display = 'none';
        
        const container = document.getElementById('canvas-container');
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          container.appendChild(canvas);
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
        }
      } catch(err) {
        statusEl.innerText = "Error loading PDF: " + err.message;
        statusEl.style.color = "#f87171";
      }
    })();
  </script>
</body>
</html>
`;

const typeIconMap = (type) => {
    if (!type) return { name: 'file', color: '#94a3b8' };
    if (type.startsWith('image/')) return { name: 'image', color: '#a78bfa' };
    if (type.startsWith('video/')) return { name: 'video', color: '#60a5fa' };
    if (type.startsWith('audio/')) return { name: 'music', color: '#34d399' };
    if (type.includes('pdf')) return { name: 'file-text', color: '#f87171' };
    if (type.includes('zip') || type.includes('archive')) return { name: 'archive', color: '#fbbf24' };
    if (type.includes('word') || type.includes('doc')) return { name: 'file-text', color: '#60a5fa' };
    if (type.includes('excel') || type.includes('sheet')) return { name: 'grid', color: '#34d399' };
    return { name: 'file', color: '#94a3b8' };
};

const isImageType = (type) => type && type.startsWith('image/');
const isVideoType = (type) => type && type.startsWith('video/');

const ToastBanner = ({ toast }) => {
    if (!toast) return null;
    return (
        <View style={[styles.toast, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
            <Feather name={toast.type === 'error' ? 'x-circle' : 'check-circle'} size={15} color="#fff" />
            <Text style={styles.toastText} numberOfLines={2}>{toast.msg}</Text>
        </View>
    );
};

const PreviewModal = ({ visible, file, onClose, onDownload }) => {
    const [status, setStatus] = useState('idle');
    const [pdfBase64, setPdfBase64] = useState(null);
    const [localUri, setLocalUri] = useState(null);
    const [errMsg, setErrMsg] = useState('');
    const videoRef = useRef(null);

    useEffect(() => {
        if (!visible || !file) { setStatus('idle'); setLocalUri(null); setErrMsg(''); setPdfBase64(null); return; }
        let cancelled = false;
        let downloadResumable = null;
        setStatus('loading');
        setLocalUri(null);
        setErrMsg('');
        setPdfBase64(null);

        const load = async () => {
            try {
                const token = await storage.getItem('userToken');
                const url = `${BASE_URL}files/${file.id}/download`;
                const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
                const dest = `${FileSystem.cacheDirectory}prev_${file.id}.${ext}`;

                downloadResumable = FileSystem.createDownloadResumable(
                    url,
                    dest,
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                );

                const result = await downloadResumable.downloadAsync();
                if (cancelled) return;

                if (!result) {
                    setErrMsg('Download was cancelled');
                    setStatus('error');
                    return;
                }

                if (result.status !== 200) {
                    setErrMsg(`Server returned ${result.status}`);
                    setStatus('error');
                    return;
                }

                setLocalUri(result.uri);

                if (isImageType(file.type)) {
                    setStatus('image');
                } else if (isVideoType(file.type)) {
                    setStatus('video');
                } else if (file.type?.includes('pdf')) {
                    const b64 = await FileSystem.readAsStringAsync(result.uri, { encoding: 'base64' });
                    setPdfBase64(b64);
                    setStatus('pdf');
                } else {
                    setStatus('open');
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(result.uri, {
                            mimeType: file.type || 'application/octet-stream',
                            dialogTitle: `Open ${file.name}`,
                            UTI: file.type,
                        });
                    } else {
                        await Linking.openURL(result.uri);
                    }
                }
            } catch (e) {
                console.error('Preview error:', e);
                if (!cancelled) {
                    setErrMsg(e.message || 'Unknown error');
                    setStatus('error');
                }
            }
        };

        load();
        return () => {
            cancelled = true;
            if (downloadResumable) downloadResumable.pauseAsync().catch(() => { });
        };
    }, [visible, file]);

    const openExternal = async () => {
        if (!localUri) return;
        try {
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(localUri, {
                    mimeType: file.type || 'application/octet-stream',
                    dialogTitle: `Open ${file.name}`,
                });
            } else {
                await Linking.openURL(localUri);
            }
        } catch (e) {
            Alert.alert('Error', 'Could not open this file.');
        }
    };

    if (!file) return null;
    const icon = typeIconMap(file.type);

    return (
        <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
            <View style={styles.previewRoot}>
                {/* Header */}
                <View style={styles.previewHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.previewHeaderBtn}>
                        <Feather name="arrow-left" size={22} color={COLORS.textWhite} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <Text style={styles.previewTitle} numberOfLines={1}>{file.name}</Text>
                        <Text style={styles.previewSub}>{fmtSize(file.size)} · {file.type?.split('/')[1] || 'file'}</Text>
                    </View>
                    <TouchableOpacity onPress={onDownload} style={styles.previewDlBtn}>
                        <Feather name="download" size={18} color="#fff" />
                        <Text style={styles.previewDlText}>Save</Text>
                    </TouchableOpacity>
                </View>

                {/* Body */}
                <View style={styles.previewBody}>

                    {/* Loading */}
                    {status === 'loading' && (
                        <View style={styles.previewCenter}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.previewStatusText}>Loading preview…</Text>
                        </View>
                    )}

                    {/* ── Inline Image ── */}
                    {status === 'image' && localUri && (
                        <Image source={{ uri: localUri }} style={styles.previewImage} resizeMode="contain" />
                    )}

                    {/* ── Inline Video (expo-av) ── */}
                    {status === 'video' && localUri && (
                        <Video
                            ref={videoRef}
                            source={{ uri: localUri }}
                            style={styles.previewVideo}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            isLooping={false}
                            onError={() => { setErrMsg('Video playback error'); setStatus('error'); }}
                        />
                    )}

                    {/* ── Inline PDF (WebView) ── */}
                    {status === 'pdf' && (
                        Platform.OS === 'ios' ? (
                            localUri && (
                                <WebView
                                    source={{ uri: localUri }}
                                    style={styles.previewPdf}
                                    originWhitelist={['*']}
                                    allowFileAccess
                                />
                            )
                        ) : (
                            pdfBase64 && (
                                <WebView
                                    source={{ html: getPdfHtml(pdfBase64) }}
                                    style={styles.previewPdf}
                                    originWhitelist={['*']}
                                    allowFileAccess
                                    javaScriptEnabled
                                    domStorageEnabled
                                />
                            )
                        )
                    )}

                    {/* ── PDF/Doc — share sheet auto-opens, show fallback UI ── */}
                    {status === 'open' && (
                        <View style={styles.previewCenter}>
                            <View style={[styles.previewIconBg, { backgroundColor: icon.color + '22' }]}>
                                <Feather name={icon.name} size={64} color={icon.color} />
                            </View>
                            <Text style={styles.previewUnsupportedTitle}>{file.name}</Text>
                            <Text style={styles.previewUnsupportedSub}>
                                {file.type?.includes('pdf')
                                    ? 'Opening in your PDF viewer…'
                                    : 'Opening in an external app…'}
                            </Text>
                            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 20 }]} onPress={openExternal}>
                                <Feather name="external-link" size={16} color="#fff" />
                                <Text style={styles.btnPrimaryText}>Open Again</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnSecondary, { marginTop: 10 }]} onPress={onDownload}>
                                <Feather name="download" size={16} color={COLORS.textLight} />
                                <Text style={styles.btnSecondaryText}>Save to Device</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Error */}
                    {status === 'error' && (
                        <View style={styles.previewCenter}>
                            <View style={[styles.previewIconBg, { backgroundColor: COLORS.danger + '22' }]}>
                                <Feather name="alert-circle" size={64} color={COLORS.danger} />
                            </View>
                            <Text style={styles.previewUnsupportedTitle}>Preview Failed</Text>
                            <Text style={styles.previewUnsupportedSub}>{errMsg || 'Could not fetch this file.'}</Text>
                            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 20 }]} onPress={onDownload}>
                                <Feather name="download" size={16} color="#fff" />
                                <Text style={styles.btnPrimaryText}>Download Instead</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const NewFolderModal = ({ visible, onClose, onCreate, pathLabel }) => {
    const [name, setName] = useState('');
    const [kbHeight, setKbHeight] = useState(0);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
        return () => { show.remove(); hide.remove(); };
    }, []);

    const handleCreate = () => {
        if (!name.trim()) return;
        onCreate(name.trim());
        setName('');
    };
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { marginBottom: kbHeight }]}>
                    <View style={styles.modalHeader}>
                        <View style={[styles.modalIconWrap, { backgroundColor: COLORS.primary + '33' }]}>
                            <Feather name="folder-plus" size={20} color={COLORS.primaryLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>New Folder</Text>
                            <Text style={styles.modalSub} numberOfLines={1}>Location: {pathLabel}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={COLORS.textMuted} /></TouchableOpacity>
                    </View>
                    <Text style={styles.inputLabel}>Folder Name</Text>
                    <TextInput
                        style={styles.modalInput}
                        placeholder="e.g. Project Documents"
                        placeholderTextColor={COLORS.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        onSubmitEditing={handleCreate}
                    />
                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
                            <Text style={styles.btnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnPrimary, { flex: 2 }, !name.trim() && { opacity: 0.5 }]} onPress={handleCreate} disabled={!name.trim()}>
                            <Feather name="folder-plus" size={15} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Create Folder</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const RenameModal = ({ visible, item, onClose, onRename }) => {
    const [name, setName] = useState('');
    const [kbHeight, setKbHeight] = useState(0);

    useEffect(() => { if (item) setName(item.name); }, [item]);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
        return () => { show.remove(); hide.remove(); };
    }, []);

    const isValid = name.trim() && name.trim() !== item?.name;
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { marginBottom: kbHeight }]}>
                    <View style={styles.modalHeader}>
                        <View style={[styles.modalIconWrap, { backgroundColor: '#f59e0b33' }]}>
                            <Feather name="edit-2" size={18} color="#f59e0b" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>Rename</Text>
                            <Text style={styles.modalSub}>{item?.isFolder ? 'Rename folder' : 'Rename file'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={COLORS.textMuted} /></TouchableOpacity>
                    </View>
                    <View style={styles.renameCurrentRow}>
                        <Text style={styles.renameLabelText}>Current:</Text>
                        <View style={styles.renameChip}><Text style={styles.renameChipText} numberOfLines={1}>{item?.name}</Text></View>
                    </View>
                    <Text style={styles.inputLabel}>New Name</Text>
                    <TextInput
                        style={styles.modalInput}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                        selectTextOnFocus
                        onSubmitEditing={() => isValid && onRename(name.trim())}
                        placeholderTextColor={COLORS.textMuted}
                    />
                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
                            <Text style={styles.btnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnPrimary, { flex: 2 }, !isValid && { opacity: 0.5 }]} onPress={() => isValid && onRename(name.trim())} disabled={!isValid}>
                            <Feather name="check" size={15} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Save Name</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const MoveModal = ({ visible, item, itemType, onClose, onMove }) => {
    const [sel, setSel] = useState('root');
    const [targets, setTargets] = useState([]);
    const [treeLoading, setTreeLoading] = useState(true);

    useEffect(() => {
        if (!visible) return;
        setTreeLoading(true);
        setSel('root');
        getFolderTree()
            .then(treeNodes => {
                const flat = [{ id: 'root', name: 'Folders & Files', depth: 0 }];
                const build = (nodes, depth) => {
                    nodes.forEach(n => {
                        if (itemType === 'folder' && n.id === item?.id) return;
                        flat.push({ id: n.id, name: n.name, depth });
                        if (n.children?.length) build(n.children, depth + 1);
                    });
                };
                build(treeNodes, 1);
                setTargets(flat);
            })
            .catch(() => setTargets([{ id: 'root', name: 'Folders & Files', depth: 0 }]))
            .finally(() => setTreeLoading(false));
    }, [visible]);

    const selectedTarget = targets.find(t => t.id === sel);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { maxHeight: '80%' }]}>
                    <View style={styles.modalHeader}>
                        <View style={[styles.modalIconWrap, { backgroundColor: COLORS.primary + '33' }]}>
                            <Feather name="move" size={18} color={COLORS.primaryLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>Move Item</Text>
                            <Text style={styles.modalSub} numberOfLines={1}>"{item?.name}"</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={COLORS.textMuted} /></TouchableOpacity>
                    </View>
                    <View style={styles.moveDestRow}>
                        <Text style={styles.inputLabel}>Destination: </Text>
                        <View style={styles.moveDestChip}>
                            <Feather name="folder" size={13} color={COLORS.primaryLight} />
                            <Text style={styles.moveDestChipText}>{selectedTarget?.name || '…'}</Text>
                        </View>
                    </View>
                    <ScrollView style={styles.folderPicker} showsVerticalScrollIndicator={false}>
                        {treeLoading ? (
                            <View style={styles.pickerLoading}>
                                <ActivityIndicator size="small" color={COLORS.primary} />
                                <Text style={styles.pickerLoadingText}>Loading folders…</Text>
                            </View>
                        ) : targets.map(t => (
                            <TouchableOpacity key={t.id} style={[styles.pickerItem, sel === t.id && styles.pickerItemSelected]} onPress={() => setSel(t.id)}>
                                <Feather name="folder" size={15} color={t.id === 'root' ? COLORS.warning : COLORS.textMuted} style={{ marginLeft: t.depth * 16 }} />
                                <Text style={[styles.pickerItemText, sel === t.id && { color: COLORS.primaryLight }]}>{t.name}</Text>
                                {t.id === 'root' && <View style={styles.rootBadge}><Text style={styles.rootBadgeText}>Root</Text></View>}
                                {sel === t.id && <Feather name="check" size={14} color={COLORS.primaryLight} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
                            <Text style={styles.btnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnPrimary, { flex: 2 }, treeLoading && { opacity: 0.5 }]} onPress={() => onMove(sel === 'root' ? null : sel)} disabled={treeLoading}>
                            <Feather name="move" size={15} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Move Here</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const CtxMenu = ({ visible, item, isFile, onClose, handlers, isAdmin }) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { paddingBottom: 30 }]}>
                <View style={styles.modalHeader}>
                    <View style={[styles.modalIconWrap, { backgroundColor: COLORS.primary + '33' }]}>
                        <Feather name={isFile ? 'file' : 'folder'} size={18} color={COLORS.primaryLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>{isFile ? 'File Options' : 'Folder Options'}</Text>
                        <Text style={styles.modalSub} numberOfLines={1}>"{item?.name}"</Text>
                    </View>
                    <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={COLORS.textMuted} /></TouchableOpacity>
                </View>

                {isFile && (
                    <>
                        <TouchableOpacity style={styles.menuRow} onPress={handlers.view}>
                            <Feather name="eye" size={18} color={COLORS.textLight} />
                            <Text style={styles.menuRowText}>Preview</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuRow} onPress={handlers.download}>
                            <Feather name="download" size={18} color={COLORS.textLight} />
                            <Text style={styles.menuRowText}>Download</Text>
                        </TouchableOpacity>
                        {isAdmin && <View style={styles.menuDivider} />}
                    </>
                )}

                {isAdmin && (
                    <>
                        <TouchableOpacity style={styles.menuRow} onPress={handlers.rename}>
                            <Feather name="edit-2" size={18} color={COLORS.textLight} />
                            <Text style={styles.menuRowText}>Rename</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuRow} onPress={handlers.move}>
                            <Feather name="move" size={18} color={COLORS.textLight} />
                            <Text style={styles.menuRowText}>Move</Text>
                        </TouchableOpacity>
                        <View style={styles.menuDivider} />
                        <TouchableOpacity style={styles.menuRow} onPress={handlers.delete}>
                            <Feather name="trash-2" size={18} color={COLORS.danger} />
                            <Text style={[styles.menuRowText, { color: COLORS.danger }]}>Delete</Text>
                        </TouchableOpacity>
                    </>
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    </Modal>
);

const FilesScreen = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [currentId, setCurrentId] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'Folders & Files' }]);
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [search, setSearch] = useState('');
    const [toast, setToast] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [modal, setModal] = useState(null);
    const [ctx, setCtx] = useState(null);

    const closeModal = () => setModal(null);
    const closeCtx = () => setCtx(null);

    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const loadFolder = useCallback(async (id = null, fetchPage = 1) => {
        try {
            if (fetchPage === 1) { setDataLoading(true); setFolders([]); setFiles([]); }
            else setLoadingMore(true);

            const data = await browseFolder(id, fetchPage, 50, '');

            if (fetchPage === 1) {
                setFolders(data.folders || []);
                setFiles(data.files || []);
                setBreadcrumbs([{ id: null, name: 'Folders & Files' }, ...(data.breadcrumbs || [])]);
                setCurrentId(id);
            } else {
                setFiles(prev => [...prev, ...(data.files || [])]);
            }
            setHasMore(data.hasMore || false);
            setPage(fetchPage);
        } catch (err) {
            showToast('Failed to load folder', 'error');
        } finally {
            setDataLoading(false);
            setLoadingMore(false);
        }
    }, [showToast]);

    useEffect(() => { loadFolder(null, 1); }, []);

    const isRoot = currentId === null;
    const pathLabel = breadcrumbs.map(b => b.name).join(' / ');

    const enterFolder = (id) => { setSearch(''); loadFolder(id); };
    const goToIdx = (idx) => { setSearch(''); loadFolder(breadcrumbs[idx].id); };
    const goBack = () => { setSearch(''); loadFolder(breadcrumbs[breadcrumbs.length - 2]?.id ?? null); };

    const q = search.toLowerCase();
    const visibleFolders = folders.filter(f => {
        const sizeStr = fmtSize(f.calculatedSize || 0).toLowerCase();
        return f.name.toLowerCase().includes(q) || sizeStr.includes(q);
    });
    const visibleFiles = files.filter(f => {
        const sizeStr = fmtSize(f.size || 0).toLowerCase();
        return f.name.toLowerCase().includes(q) || sizeStr.includes(q);
    });
    const isEmpty = visibleFolders.length === 0 && visibleFiles.length === 0;

    const openCtx = (item, itemType) => setCtx({ item, itemType, isFile: itemType === 'file' });

    const ctxAction = (action) => {
        const { item, itemType } = ctx;
        closeCtx();
        if (action === 'view') setModal({ type: 'preview', item });
        else if (action === 'download') handleDownload(item);
        else if (action === 'rename') setModal({ type: 'rename', item, itemType });
        else if (action === 'move') setModal({ type: 'move', item, itemType });
        else if (action === 'delete') handleDelete(item, itemType);
    };

    const doCreateFolder = async (name) => {
        try {
            const res = await apiCreateFolder(name, currentId);
            setFolders(p => [...p, res.folder]);
            closeModal();
            showToast(`Folder "${name}" created`);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to create folder', 'error');
        }
    };

    const doRename = async (newName) => {
        const { item, itemType } = modal;
        try {
            if (itemType === 'folder') {
                await apiUpdateFolder(item.id, newName);
                setFolders(p => p.map(f => f.id === item.id ? { ...f, name: newName } : f));
            } else {
                await apiUpdateFile(item.id, newName);
                setFiles(p => p.map(f => f.id === item.id ? { ...f, name: newName } : f));
            }
            closeModal();
            showToast(`Renamed to "${newName}"`);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to rename', 'error');
        }
    };

    const doMove = async (targetId) => {
        const { item, itemType } = modal;
        try {
            if (itemType === 'folder') await apiUpdateFolder(item.id, item.name, targetId);
            else await apiUpdateFile(item.id, item.name, targetId);
            closeModal();
            loadFolder(currentId);
            showToast(`Moved "${item.name}"`);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to move', 'error');
        }
    };

    const handleDelete = (item, itemType) => {
        Alert.alert(
            `Delete ${itemType === 'folder' ? 'Folder' : 'File'}`,
            itemType === 'folder'
                ? `"${item.name}" and all its nested content will be permanently deleted.`
                : `"${item.name}" will be permanently removed from storage.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            if (itemType === 'folder') {
                                await apiDeleteFolder(item.id);
                                setFolders(p => p.filter(f => f.id !== item.id));
                                loadFolder(currentId);
                            } else {
                                await apiDeleteFile(item.id);
                                setFiles(p => p.filter(f => f.id !== item.id));
                            }
                            showToast(`"${item.name}" deleted`, 'error');
                        } catch (err) {
                            showToast(err.response?.data?.error || 'Failed to delete', 'error');
                        }
                    },
                },
            ],
        );
    };

    const handleDownload = async (file) => {
        try {
            showToast(`Downloading "${file.name}"…`);
            const token = await storage.getItem('userToken');
            const url = `${BASE_URL}files/${file.id}/download`;
            const dest = FileSystem.documentDirectory + encodeURIComponent(file.name);
            const dl = await FileSystem.downloadAsync(url, dest, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (Platform.OS === 'android') {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (permissions.granted) {
                    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                        permissions.directoryUri,
                        file.name,
                        file.type || 'application/octet-stream'
                    );
                    const base64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: 'base64' });
                    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
                    showToast(`Saved "${file.name}" successfully`);
                } else {
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(dl.uri, {
                            mimeType: file.type || 'application/octet-stream',
                            dialogTitle: `Save ${file.name}`,
                        });
                    }
                }
            } else {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(dl.uri, {
                        mimeType: file.type || 'application/octet-stream',
                        dialogTitle: `Save ${file.name}`,
                    });
                } else {
                    showToast('Sharing not available on this device', 'error');
                }
            }
        } catch (err) {
            console.error('Download error:', err);
            showToast('Failed to download file', 'error');
        }
    };

    const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
    const [alertConfig, setAlertConfig] = useState(null);

    const showAlert = (title, message, type = 'error', onConfirm = null) => {
        setAlertConfig({ visible: true, title, message, type, onConfirm });
    };

    const closeAlert = () => setAlertConfig(null);

    const doUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.length) return;
            const asset = result.assets[0];

            if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
                const limitStr = fmtSize(MAX_FILE_SIZE_BYTES);
                const fileStr = fmtSize(asset.size);
                showAlert(
                    'File Size Exceeded',
                    `"${asset.name}" (${fileStr}) exceeds maximum allowed upload limit of ${limitStr}. Please select a smaller file.`,
                    'error'
                );
                return;
            }

            setUploading(true);
            const fileObj = { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' };
            const res = await apiUploadFile(fileObj, currentId);
            setFiles(p => [...p, res.file]);
            showAlert('Upload Successful', `"${asset.name}" (${fmtSize(asset.size || res.file.size)}) has been added to your storage.`, 'success');
        } catch (err) {
            console.error('Upload error:', err);
            const serverMsg = err.response?.data?.error || err.message;
            if (err.response?.status === 413 || serverMsg?.toLowerCase().includes('large') || serverMsg?.toLowerCase().includes('limit')) {
                showAlert(
                    'Upload Limit Exceeded',
                    `Server rejected request. The file exceeds the server limit of 100 MB.`,
                    'error'
                );
            } else {
                showAlert('Upload Error', serverMsg || 'Failed to upload file. Please try again.', 'error');
            }
        } finally {
            setUploading(false);
        }
    };

    const loadMore = () => {
        if (hasMore && !loadingMore && !dataLoading && !search) loadFolder(currentId, page + 1);
    };

    return (
        <View style={styles.root}>
            <ToastBanner toast={toast} />

            {/* ── Page Header ── */}
            <View style={styles.pageHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.pageTitle}>
                        {isRoot ? 'Folders & Files' : breadcrumbs[breadcrumbs.length - 1]?.name}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                        {breadcrumbs.map((b, i) => (
                            <View key={i} style={styles.breadcrumbItem}>
                                {i > 0 && <Feather name="chevron-right" size={12} color={COLORS.textMuted} style={{ marginHorizontal: 3 }} />}
                                <TouchableOpacity onPress={() => i < breadcrumbs.length - 1 && goToIdx(i)}>
                                    <Text style={[styles.breadcrumbText, i === breadcrumbs.length - 1 && styles.breadcrumbActive]}>
                                        {b.name}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
                {!isRoot && (
                    <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                        <Feather name="arrow-left" size={16} color={COLORS.textLight} />
                        <Text style={styles.backBtnText}>Back</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Toolbar ── */}
            <View style={styles.toolbar}>
                <View style={styles.searchWrap}>
                    <Feather name="search" size={15} color={COLORS.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={`Search in ${isRoot ? 'Folders & Files' : 'this folder'}…`}
                        placeholderTextColor={COLORS.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {!!search && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Feather name="x" size={15} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
                {isAdmin && (
                    <>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => setModal({ type: 'createFolder' })}>
                            <Feather name="folder-plus" size={16} color={COLORS.primaryLight} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                            onPress={doUpload}
                            disabled={uploading}
                        >
                            {uploading
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Feather name="upload" size={16} color="#fff" />}
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* ── Viewer Notice ── */}
            {!isAdmin && (
                <View style={styles.viewerNotice}>
                    <Feather name="alert-triangle" size={13} color={COLORS.warning} />
                    <Text style={styles.viewerNoticeText}>Viewer mode — browse, preview & download only.</Text>
                </View>
            )}

            {/* ── Content ── */}
            {dataLoading ? (
                <PageLoader message="Loading files and folders..." />
            ) : (
                <FlatList
                    data={[
                        ...visibleFolders.map(f => ({ ...f, _kind: 'folder' })),
                        ...visibleFiles.map(f => ({ ...f, _kind: 'file' }))
                    ]}
                    keyExtractor={item => item._kind === 'folder' ? `fld-${item.id}` : `fil-${item.id}`}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scroll}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={Platform.OS === 'android'}
                    ListHeaderComponent={(
                        <>
                            {/* Root welcome */}
                            {isRoot && isAdmin && folders.length === 0 && files.length === 0 && !search && (
                                <View style={styles.welcomeBanner}>
                                    <Text style={styles.welcomeEmoji}>📁</Text>
                                    <Text style={styles.welcomeTitle}>Start by creating a folder</Text>
                                    <Text style={styles.welcomeSub}>Organise your files by creating folders first.</Text>
                                    <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={() => setModal({ type: 'createFolder' })}>
                                        <Feather name="folder-plus" size={15} color="#fff" />
                                        <Text style={styles.btnPrimaryText}>Create Your First Folder</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {visibleFolders.length > 0 && (
                                <Text style={styles.sectionLabel}>Folders ({visibleFolders.length})</Text>
                            )}
                        </>
                    )}
                    renderItem={({ item, index }) => {
                        if (item._kind === 'folder') {
                            return (
                                <TouchableOpacity
                                    style={styles.row}
                                    onPress={() => enterFolder(item.id)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[styles.rowIcon, { backgroundColor: COLORS.warning + '22' }]}>
                                        <Feather name="folder" size={22} color={COLORS.warning} />
                                    </View>
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.rowMeta}>{item.itemCount || 0} items · {fmtSize(item.calculatedSize || 0)}</Text>
                                    </View>
                                    <View style={styles.rowActions}>
                                        {isAdmin && (
                                            <TouchableOpacity style={styles.iconBtn} onPress={() => openCtx({ ...item, isFolder: true }, 'folder')}>
                                                <Feather name="more-vertical" size={17} color={COLORS.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        }

                        const icon = typeIconMap(item.type);
                        const isFirstFile = index === visibleFolders.length;
                        return (
                            <>
                                {isFirstFile && (
                                    <Text style={[styles.sectionLabel, visibleFolders.length > 0 && { marginTop: 20 }]}>
                                        Files ({visibleFiles.length})
                                    </Text>
                                )}
                                <View style={styles.row}>
                                    <TouchableOpacity
                                        style={[styles.rowIcon, { backgroundColor: icon.color + '22' }]}
                                        onPress={() => setModal({ type: 'preview', item: item })}
                                        activeOpacity={0.7}
                                    >
                                        <Feather name={icon.name} size={22} color={icon.color} />
                                    </TouchableOpacity>
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.rowMeta}>{fmtSize(item.size)} · {item.type?.split('/')[1] || 'file'}</Text>
                                    </View>
                                    <View style={styles.rowActions}>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => setModal({ type: 'preview', item: item })}>
                                            <Feather name="eye" size={16} color={COLORS.textMuted} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDownload(item)}>
                                            <Feather name="download" size={16} color={COLORS.textMuted} />
                                        </TouchableOpacity>
                                        {isAdmin && (
                                            <TouchableOpacity style={styles.iconBtn} onPress={() => openCtx({ ...item, isFolder: false }, 'file')}>
                                                <Feather name="more-vertical" size={17} color={COLORS.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </>
                        );
                    }}
                    ListFooterComponent={(
                        <>
                            {/* Empty states */}
                            {!isRoot && isEmpty && !search && (
                                <View style={styles.emptyState}>
                                    <Feather name="folder" size={52} color={COLORS.border} />
                                    <Text style={styles.emptyTitle}>This folder is empty</Text>
                                    <Text style={styles.emptySub}>{isAdmin ? 'Create a sub-folder or upload files here' : 'No content yet'}</Text>
                                    {isAdmin && (
                                        <View style={styles.emptyActions}>
                                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setModal({ type: 'createFolder' })}>
                                                <Text style={styles.btnSecondaryText}>New Sub-folder</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.btnPrimary} onPress={doUpload}>
                                                <Text style={styles.btnPrimaryText}>Upload File</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}
                            {isEmpty && !!search && (
                                <View style={styles.emptyState}>
                                    <Feather name="search" size={52} color={COLORS.border} />
                                    <Text style={styles.emptyTitle}>No results for "{search}"</Text>
                                    <Text style={styles.emptySub}>Try a different search term</Text>
                                    <TouchableOpacity style={[styles.btnSecondary, { marginTop: 12 }]} onPress={() => setSearch('')}>
                                        <Text style={styles.btnSecondaryText}>Clear Search</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {loadingMore && (
                                <View style={styles.loadMoreRow}>
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                    <Text style={{ fontSize: 12, color: COLORS.textMuted, marginLeft: 8 }}>Loading more files...</Text>
                                </View>
                            )}
                        </>
                    )}
                />
            )}

            {/* ── Modals ── */}
            {modal?.type === 'createFolder' && (
                <NewFolderModal visible onClose={closeModal} onCreate={doCreateFolder} pathLabel={pathLabel} />
            )}
            {modal?.type === 'rename' && (
                <RenameModal
                    visible
                    item={modal.item ? { ...modal.item, isFolder: modal.itemType === 'folder' } : null}
                    onClose={closeModal}
                    onRename={doRename}
                />
            )}
            {modal?.type === 'move' && (
                <MoveModal visible item={modal.item} itemType={modal.itemType} onClose={closeModal} onMove={doMove} />
            )}
            {modal?.type === 'preview' && (
                <PreviewModal
                    visible
                    file={modal.item}
                    onClose={closeModal}
                    onDownload={() => { handleDownload(modal.item); closeModal(); }}
                />
            )}
            {ctx && (
                <CtxMenu
                    visible={!!ctx}
                    item={ctx.item}
                    isFile={ctx.isFile}
                    handlers={{
                        view: () => ctxAction('view'),
                        download: () => ctxAction('download'),
                        rename: () => ctxAction('rename'),
                        move: () => ctxAction('move'),
                        delete: () => ctxAction('delete'),
                    }}
                    onClose={closeCtx}
                    isAdmin={isAdmin}
                />
            )}
            {alertConfig && (
                <CustomAlertModal
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={closeAlert}
                    onConfirm={alertConfig.onConfirm}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { paddingHorizontal: 16, paddingBottom: 40 },

    toast: {
        position: 'absolute', top: 0, left: 16, right: 16, zIndex: 999,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 8,
    },
    toastSuccess: { backgroundColor: '#059669' },
    toastError: { backgroundColor: COLORS.danger },
    toastText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

    pageHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, gap: 12 },
    pageTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textWhite },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 },
    backBtnText: { color: COLORS.textLight, fontWeight: '600', fontSize: 13 },

    breadcrumbItem: { flexDirection: 'row', alignItems: 'center' },
    breadcrumbText: { fontSize: 12, color: COLORS.primaryLight, fontWeight: '500' },
    breadcrumbActive: { color: COLORS.primaryLight, fontWeight: '700' },

    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    searchWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.bgInput, borderRadius: 12,
        paddingHorizontal: 12, gap: 8, height: 42,
        borderWidth: 1, borderColor: COLORS.border,
    },
    searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
    actionBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },

    viewerNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.warning + '18', borderRadius: 10, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8 },
    viewerNoticeText: { flex: 1, fontSize: 12, color: COLORS.warning, fontWeight: '500' },

    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.textMuted, fontSize: 14 },

    sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    rowMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    iconBtn: { padding: 6, borderRadius: 8 },

    welcomeBanner: { alignItems: 'center', padding: 32, backgroundColor: COLORS.bgCard, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
    welcomeEmoji: { fontSize: 48, marginBottom: 12 },
    welcomeTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textWhite, textAlign: 'center', marginBottom: 6 },
    welcomeSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },

    emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMuted, marginTop: 16 },
    emptySub: { fontSize: 13, color: COLORS.border, marginTop: 6, textAlign: 'center' },
    emptyActions: { flexDirection: 'row', gap: 12, marginTop: 20 },

    loadMoreRow: { alignItems: 'center', paddingVertical: 16 },

    btnPrimary: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnSecondary: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
    btnSecondaryText: { color: COLORS.textLight, fontWeight: '600', fontSize: 14 },
    btnCancel: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    btnCancelText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },

    overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
    modalCard: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderTopWidth: 1, borderColor: COLORS.border },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    modalIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textWhite },
    modalSub: { fontSize: 12, color: COLORS.textMuted },
    inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
    modalInput: { backgroundColor: COLORS.bgInput, color: COLORS.text, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 16 },
    modalFooter: { flexDirection: 'row', gap: 10 },

    renameCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    renameLabelText: { fontSize: 12, color: COLORS.textMuted },
    renameChip: { flex: 1, backgroundColor: COLORS.bgInput, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    renameChipText: { color: COLORS.text, fontSize: 13 },

    moveDestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    moveDestChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primary + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    moveDestChipText: { color: COLORS.primaryLight, fontSize: 13, fontWeight: '600' },
    folderPicker: { maxHeight: 220, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
    pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    pickerItemSelected: { backgroundColor: COLORS.primary + '18' },
    pickerItemText: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },
    pickerLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
    pickerLoadingText: { color: COLORS.textMuted, fontSize: 13 },
    rootBadge: { backgroundColor: COLORS.warning + '33', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    rootBadgeText: { fontSize: 10, color: COLORS.warning, fontWeight: '700' },

    menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderRadius: 10 },
    menuRowText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
    menuDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

    previewRoot: { flex: 1, backgroundColor: COLORS.bg },
    previewHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    previewHeaderBtn: { padding: 6 },
    previewTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textWhite },
    previewSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    previewDlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    previewDlText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    previewBody: { flex: 1 },
    previewCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
    previewStatusText: { color: COLORS.textMuted, fontSize: 14 },
    previewImage: { flex: 1, width: '100%' },
    previewVideo: { flex: 1, width: '100%', backgroundColor: '#000' },
    previewPdf: { flex: 1, width: '100%' },
    previewIconBg: { width: 110, height: 110, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    previewUnsupportedTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textWhite, textAlign: 'center' },
    previewUnsupportedSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
});

export default FilesScreen;
