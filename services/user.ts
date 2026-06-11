import request from "./request";

export interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

export interface CreateUserParams {
  username: string;
  password: string;
}

export interface UpdateUserParams {
  username?: string;
  password?: string;
}

export function getUsers() {
  return request.get<User[]>("/users");
}

export function getUser(id: number) {
  return request.get<User>(`/users/${id}`);
}

export function createUser(data: CreateUserParams) {
  return request.post<User>("/users", data);
}

export function updateUser(id: number, data: UpdateUserParams) {
  return request.patch<User>(`/users/${id}`, data);
}

export function deleteUser(id: number) {
  return request.delete(`/users/${id}`);
}
