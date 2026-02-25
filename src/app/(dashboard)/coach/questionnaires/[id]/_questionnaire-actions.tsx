"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AssignModal } from "../_assign-modal";

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
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/questionnaires/${questionnaireId}`, {
        method: "DELETE",
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

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/coach/questionnaires/${questionnaireId}?edit=true`}>
          <Button variant="outline" className="text-sm">
            Edit
          </Button>
        </Link>
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
