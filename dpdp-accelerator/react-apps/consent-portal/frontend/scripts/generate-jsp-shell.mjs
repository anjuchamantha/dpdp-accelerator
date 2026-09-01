/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Turns the built SPA shell into the JSP pages the webapp serves, the same way
 * the Identity Server's own My Account app is put together.
 *
 * Three pages come out of this:
 *
 *   index.jsp  the app shell, and the landing point the Identity Server
 *              redirects back to. When it sees an authorization code it
 *              forwards server side to /authenticate rather than letting the
 *              code reach page script.
 *   home.jsp   mapped at /authenticate: parks the code in the HTTP session and
 *              serves the same shell.
 *   auth.jsp   mapped at /auth: hands the parked code to the SPA once, as
 *              JSON, then clears it from the session.
 *
 * Run after the security verification, which inspects dist/index.html.
 */

import { readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const distDir = path.resolve(process.cwd(), 'dist')
const shellPath = path.join(distDir, 'index.html')

const JSP_PAGE_DIRECTIVE =
  '<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>'

/**
 * Forwards an in-flight authorization code to /authenticate so the SPA never
 * takes it from the browser URL. Request parameters survive the forward.
 */
const FORWARD_AUTH_CODE = `<jsp:scriptlet>
    if (request.getParameter("code") != null && !request.getParameter("code").trim().isEmpty()) {
        request.getRequestDispatcher("/authenticate").forward(request, response);
        return;
    }
</jsp:scriptlet>`

/** Parks the authorization code in the session for auth.jsp to hand over. */
const STORE_AUTH_CODE = `<jsp:scriptlet>
    session.setAttribute("authCode", request.getParameter("code"));
    session.setAttribute("sessionState", request.getParameter("session_state"));
    session.setAttribute("state", request.getParameter("state"));
</jsp:scriptlet>`

/**
 * Emits the parked authorization code once and clears it, so a reload cannot
 * replay it. Values are constrained to the characters an OAuth code, state or
 * session state can contain before they are written into the JSON body.
 */
const AUTH_ENDPOINT = `<%@ page language="java" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8" %>
<%!
    private static final int MAX_VALUE_LENGTH = 512;

    /** Accepts only unreserved and base64url characters; anything else yields "". */
    private String safeValue(Object value) {
        if (!(value instanceof String)) {
            return "";
        }
        String candidate = (String) value;
        if (candidate.length() > MAX_VALUE_LENGTH || !candidate.matches("[A-Za-z0-9._~+/=-]*")) {
            return "";
        }
        return candidate;
    }
%><%
    String authCode = safeValue(session.getAttribute("authCode"));
    String sessionState = safeValue(session.getAttribute("sessionState"));
    String state = safeValue(session.getAttribute("state"));

    session.removeAttribute("authCode");
    session.removeAttribute("sessionState");
    session.removeAttribute("state");

    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");

    out.print("{\\"authCode\\": \\"" + authCode + "\\", \\"sessionState\\": \\"" + sessionState
            + "\\", \\"state\\": \\"" + state + "\\"}");
%>`

async function main() {
  let shell
  try {
    shell = await readFile(shellPath, 'utf8')
  } catch {
    throw new Error(`no built shell at ${shellPath}; run vite build first`)
  }

  await writeFile(
    path.join(distDir, 'index.jsp'),
    `${JSP_PAGE_DIRECTIVE}\n${FORWARD_AUTH_CODE}\n${shell}`,
  )
  await writeFile(
    path.join(distDir, 'home.jsp'),
    `${JSP_PAGE_DIRECTIVE}\n${STORE_AUTH_CODE}\n${shell}`,
  )
  await writeFile(path.join(distDir, 'auth.jsp'), AUTH_ENDPOINT)

  // Tomcat's welcome-file list would otherwise serve index.html at the context
  // root and the JSP shell would never run.
  await rm(shellPath)

  process.stdout.write('Generated index.jsp, home.jsp and auth.jsp; removed index.html.\n')
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
