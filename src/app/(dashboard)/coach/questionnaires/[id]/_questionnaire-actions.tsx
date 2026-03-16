"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AssignModal } from "../_assign-modal";
import { csrfHeaders } from "@/lib/csrf-client";

type Props = {
  questionnaireId: string;
  status: string;
  athletes: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  assignedAthleteIds: string[];
};

export function QuestionnaireActions({
  questionnaireId,
  status,
  athletes,
  assignedAthleteIds,
}: Props) {
  const router = useRouter();
  const [showAssign, setShowAssign] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [cloning, setCloning] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/questionnaires/${questionnaireId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (res.ok) {
        router.push("/coach/questionnaires");
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  async function handleClone() {
    setCloning(true);
    try {
      const res = await fetch(
        `/api/coach/questionnaires/${questionnaireId}/clone`,
        { method: "POST", headers: csrfHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        router.push(`/coach/questionnaires/${data.questionnaire.id}`);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setCloning(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/coach/questionnaires/${questionnaireId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "archived" }),
      });
      if (res.ok) {
        router.refresh();
        setShowArchive(false);
      }
    } catch {
      // ignore
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnarchive() {
    try {
      const res = await fetch(`/api/coach/questionnaires/${questionnaireId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ status: "draft" }),
      });
      if (res.ok) router.refresh();
    } catch {
      // ignore
    }
  }

  const isArchived = status === "archived";

  return (
    <>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {!isArchived && (
          <Link href={`/coach/questionnaires/${questionnaireId}?edit=true`}>
            <Button variant="outline" className="text-sm">
              Edit
            </Button>
          </Link>
        )}

        {status === "published" && (
          <Button
            variant="secondary"
            className="text-sm"
            onClick={() => setShowAssign(true)}
          >
            Assign
          </Button>
        )}

        <Button
          variant="ghost"
          className="text-sm"
          onClick={handleClone}
          disabled={cloning}
        >
          {cloning ? "Cloning..." : "Duplicate"}
        </Button>

        {isArchived ? (
          <Button
            variant="outline"
            className="text-sm"
            onClick={handleUnarchive}
          >
            Unarchive
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="text-sm"
            onClick={() => setShowArchive(true)}
          >
            Archive
          </Button>
        )}

        <Button
          variant="danger"
          className="text-sm"
          onClick={() => setShowDelete(true)}
        >
          Delete
        </Button>
      </div>

      <AssignModal
        open={showAssign}
        onClose={() => {
          setShowAssign(false);
          router.refresh();
        }}
        questionnaireId={questionnaireId}
        athletes={athletes}
        assignedAthleteIds={assignedAthleteIds}
      />

      <ConfirmDialog
        open={showArchive}
        onClose={() => setShowArchive(false)}
        onConfirm={handleArchive}
        title="Archive Questionnaire"
        description="This will archive the questionnaire. It will no longer appear in active lists or be assignable. You can unarchive it later."
        confirmLabel="Archive"
        variant="danger"
        loading={archiving}
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Questionnaire"
        description="This will permanently delete this questionnaire, all assignments, and all responses. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
