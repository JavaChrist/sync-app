import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { Commentaire, CommentaireFormData } from '../types/commentaireTypes';

interface CommentPanelProps {
  documentId: string;
  documentNom: string;
}

const CommentPanel: React.FC<CommentPanelProps> = ({ documentId, documentNom }) => {
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Récupérer les commentaires
  useEffect(() => {
    if (!documentId) return;

    setLoading(true);
    const commentsQuery = query(
      collection(db, 'commentaires'),
      where('documentId', '==', documentId),
      orderBy('dateCreation', 'desc')
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const commentsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as Commentaire));
        setCommentaires(commentsList);
        setLoading(false);
      },
      (err) => {
        console.error('Erreur lors du chargement des commentaires:', err);
        setError('Impossible de charger les commentaires. Veuillez réessayer plus tard.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [documentId]);

  // Ajouter un commentaire
  const handleAddComment = async () => {
    if (!newComment.trim() || !auth.currentUser) return;

    try {
      // Extraire les mentions du commentaire
      const mentions: string[] = [];
      const mentionRegex = /@(\w+)/g;
      let match;
      while ((match = mentionRegex.exec(newComment)) !== null) {
        mentions.push(match[1]);
      }

      // Récupérer le NNI de l'utilisateur actuel
      const userDocRef = doc(db, 'utilisateurs', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      const userNNI = userData?.nni || auth.currentUser.displayName || auth.currentUser.email;

      await addDoc(collection(db, 'commentaires'), {
        documentId,
        auteurId: auth.currentUser.uid,
        auteurNom: userNNI,
        contenu: newComment,
        dateCreation: new Date(),
        mentions: mentions.length > 0 ? mentions : [],
        modifie: false
      });

      // Ajouter une entrée dans le journal d'activité
      await addDoc(collection(db, 'activites'), {
        documentId,
        documentNom,
        type: 'commentaire',
        utilisateurId: auth.currentUser.uid,
        utilisateurNom: userNNI,
        dateActivite: new Date(),
        details: `Commentaire ajouté: "${newComment.substring(0, 30)}${newComment.length > 30 ? '...' : ''}"`
      });

      setNewComment('');
    } catch (err) {
      console.error('Erreur lors de l\'ajout du commentaire:', err);
      setError('Impossible d\'ajouter le commentaire. Veuillez réessayer plus tard.');
    }
  };

  // Supprimer un commentaire
  const handleDeleteComment = async (commentId: string) => {
    if (!auth.currentUser) return;

    try {
      const commentRef = doc(db, 'commentaires', commentId);
      await deleteDoc(commentRef);
    } catch (err) {
      console.error('Erreur lors de la suppression du commentaire:', err);
      setError('Impossible de supprimer le commentaire. Veuillez réessayer plus tard.');
    }
  };

  // Éditer un commentaire
  const startEditing = (comment: Commentaire) => {
    setEditingId(comment.id);
    setEditText(comment.contenu);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (commentId: string) => {
    if (!editText.trim() || !auth.currentUser) return;

    try {
      const commentRef = doc(db, 'commentaires', commentId);
      await updateDoc(commentRef, {
        contenu: editText,
        modifie: true,
        dateModification: new Date()
      });
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('Erreur lors de la modification du commentaire:', err);
      setError('Impossible de modifier le commentaire. Veuillez réessayer plus tard.');
    }
  };

  // Formatter la date
  const formatDate = (date: Date | Timestamp | undefined) => {
    if (!date) return 'N/A';
    
    const jsDate = date instanceof Timestamp ? date.toDate() : new Date(date);
    
    return jsDate.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Commentaires</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Document : {documentNom}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 mb-4 mx-4">
          {error}
        </div>
      )}

      {/* Liste des commentaires */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-600 dark:text-gray-400">Chargement des commentaires...</p>
          </div>
        ) : commentaires.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-600 dark:text-gray-400">Aucun commentaire pour ce document.</p>
          </div>
        ) : (
          commentaires.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {comment.auteurNom}
                  </span>
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(comment.dateCreation)}
                  </span>
                </div>
                {auth.currentUser?.uid === comment.auteurId && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEditing(comment)}
                      className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Modifier"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {editingId === comment.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
                    rows={3}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => saveEdit(comment.id)}
                      className="px-3 py-1 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {comment.contenu}
                  </p>
                  {comment.modifie && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      Modifié le {formatDate(comment.dateModification)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Formulaire d'ajout de commentaire */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Ajouter un commentaire... Utilisez @ pour mentionner quelqu'un"
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          rows={3}
        />
        <div className="flex justify-between mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Utilisez @nom pour mentionner quelqu'un
          </p>
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim() || !auth.currentUser}
            className={`px-4 py-2 rounded-md text-white ${
              !newComment.trim() || !auth.currentUser
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Commenter
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentPanel; 