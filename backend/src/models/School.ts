// School type (SRS FR-01). The school + teacher directory is a small fixed
// directory kept as constants in registration.service.ts (SCHOOLS / TEACHERS)
// rather than a Mongo collection — only user-generated registration requests and
// notifications are persisted. This file is the shared shape for that directory.

export interface School {
  id: string;
  name: string;
}

export interface TeacherDirectoryEntry {
  id: string; // matches a User id so the teacher can log in to approve
  name: string;
  schoolId: string;
}
